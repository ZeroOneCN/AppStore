import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { LOGIN_RATE_LIMIT, SESSION_TTL_SECONDS } from "../infra/constants";
import { getEnv } from "../infra/env";
import { AppError } from "../infra/errors";

const PASSWORD_COST = 12;

/** 账号不存在时也执行一次 bcrypt 比较，避免通过响应时间枚举用户名 */
const DUMMY_PASSWORD_HASH = "$2b$12$sViaH/gRWp6PbOXa7ErrBeTKo4e.yYbXPDpWOF/SaNZh/gZllnWuu";

/** 登录失败计数：key 为客户端标识（IP），value 为次数与窗口过期时间 */
const loginFailures = new Map<string, { count: number; resetAt: number }>();

/** 针对账号的失败计数：防止攻击者轮换 IP 后无限撞库 */
const usernameFailures = new Map<string, { count: number; resetAt: number }>();

/** 单账号失败阈值（15 分钟） */
const USERNAME_RATE_LIMIT = { maxFailures: 20, windowMs: 15 * 60 * 1000 } as const;

/** 内存计数上限，避免伪造请求头造成 Map 无限增长 */
const MAX_TRACKED_KEYS = 5000;

/** 管理员会话载荷：角色字段用于统一登录后的权限分级 */
export type SessionPayload = { sub: "admin"; username: string; role: "admin" };

/**
 * 获取会话签名密钥。
 * @returns 编码后的 HS256 密钥
 */
function sessionKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

/**
 * 生成密码哈希。
 * @param plain 明文密码
 * @returns bcrypt 哈希
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_COST);
}

/**
 * 校验明文密码与哈希是否匹配。
 * @param plain 明文密码
 * @param hash 数据库中的 bcrypt 哈希
 * @returns 匹配返回 true
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * 签发管理后台会话令牌。
 * @param username 管理员用户名
 * @param now 当前毫秒时间戳，便于测试注入
 * @returns JWT 字符串
 */
export async function createSessionToken(username: string, now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new SignJWT({ sub: "admin", username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(sessionKey());
}

/**
 * 校验会话令牌。
 * @param token JWT 字符串
 * @returns 会话载荷
 * @throws AppError 令牌无效或过期时抛出 UNAUTHORIZED
 */
export async function verifySessionToken(token: string): Promise<SessionPayload> {
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    if (
      payload.role !== "admin" ||
      typeof payload.username !== "string" ||
      !payload.username
    ) {
      throw new Error("invalid admin token");
    }
    return { sub: "admin", username: payload.username, role: "admin" };
  } catch {
    throw new AppError("UNAUTHORIZED", "登录状态无效或已过期，请重新登录");
  }
}

/**
 * 计算会话 Cookie 的选项。
 * @param secure 是否启用 Secure；登录接口会按请求实际协议传入
 * @returns Next.js 兼容的 Cookie 选项
 */
export function sessionCookieOptions(secure?: boolean): {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  secure: boolean;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    // 优先按当前请求协议判断，回退到 BASE_URL
    secure: secure ?? getEnv().BASE_URL.startsWith("https://"),
  };
}

/**
 * 清理过期计数，并在数量超限时丢弃最早记录。
 * @param map 计数表
 * @returns 无
 */
function pruneFailures(map: Map<string, { count: number; resetAt: number }>): void {
  if (map.size < MAX_TRACKED_KEYS) return;
  const now = Date.now();
  for (const [key, record] of map) {
    if (now >= record.resetAt) map.delete(key);
  }
  while (map.size >= MAX_TRACKED_KEYS) {
    const oldest = map.keys().next().value;
    if (typeof oldest !== "string") break;
    map.delete(oldest);
  }
}

/**
 * 检查该账号是否已被限流。
 * @param username 用户名
 * @throws AppError 超过失败次数时抛出 RATE_LIMITED
 */
function assertUsernameNotRateLimited(username: string): void {
  const key = username.trim().toLowerCase();
  const record = usernameFailures.get(key);
  if (!record) return;
  if (Date.now() >= record.resetAt) {
    usernameFailures.delete(key);
    return;
  }
  if (record.count >= USERNAME_RATE_LIMIT.maxFailures) {
    throw new AppError("RATE_LIMITED", "尝试次数过多，请稍后再试");
  }
}

/**
 * 记录一次账号维度的登录失败。
 * @param username 用户名
 * @returns 无
 */
function recordUsernameFailure(username: string): void {
  const key = username.trim().toLowerCase();
  const now = Date.now();
  const record = usernameFailures.get(key);
  if (!record || now >= record.resetAt) {
    pruneFailures(usernameFailures);
    usernameFailures.set(key, { count: 1, resetAt: now + USERNAME_RATE_LIMIT.windowMs });
    return;
  }
  record.count += 1;
}

/**
 * 检查该客户端是否已被限流。
 * @param clientKey 客户端标识（IP）
 * @throws AppError 超过失败次数时抛出 RATE_LIMITED
 */
function assertNotRateLimited(clientKey: string): void {
  const record = loginFailures.get(clientKey);
  if (!record) return;
  if (Date.now() >= record.resetAt) {
    loginFailures.delete(clientKey);
    return;
  }
  if (record.count >= LOGIN_RATE_LIMIT.maxFailures) {
    throw new AppError("RATE_LIMITED", "尝试次数过多，请 5 分钟后再试");
  }
}

/**
 * 记录一次登录失败。
 * @param clientKey 客户端标识（IP）
 * @returns 无
 */
function recordFailure(clientKey: string): void {
  const now = Date.now();
  const record = loginFailures.get(clientKey);
  if (!record || now >= record.resetAt) {
    pruneFailures(loginFailures);
    loginFailures.set(clientKey, { count: 1, resetAt: now + LOGIN_RATE_LIMIT.windowMs });
    return;
  }
  record.count += 1;
}

/**
 * 清除该客户端的失败计数（登录成功后调用）。
 * @param clientKey 客户端标识（IP）
 * @returns 无
 */
function clearFailures(clientKey: string): void {
  loginFailures.delete(clientKey);
}

/**
 * 管理员登录：校验限流、账号密码，成功后返回会话令牌。
 * @param username 用户名
 * @param password 明文密码
 * @param clientKey 客户端标识（通常为 IP）
 * @returns JWT 会话令牌
 * @throws AppError 限流、账号不存在或密码错误时抛出
 */
export async function login(username: string, password: string, clientKey: string): Promise<string> {
  assertNotRateLimited(clientKey);
  assertUsernameNotRateLimited(username);

  const user = await prisma.adminUser.findUnique({ where: { username } });
  const matched = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !matched) {
    recordFailure(clientKey);
    recordUsernameFailure(username);
    throw new AppError("UNAUTHORIZED", "用户名或密码错误");
  }

  clearFailures(clientKey);
  usernameFailures.delete(username.trim().toLowerCase());
  return createSessionToken(user.username);
}

/**
 * 修改管理员密码：校验当前密码后写入新哈希。
 * @param username 管理员用户名
 * @param currentPassword 当前明文密码
 * @param newPassword 新明文密码
 * @returns 无
 * @throws AppError 账号不存在、当前密码错误或新密码不合规时抛出
 */
export async function changePassword(
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) {
    throw new AppError("VALIDATION_FAILED", "新密码至少 8 位");
  }
  if (newPassword === currentPassword) {
    throw new AppError("VALIDATION_FAILED", "新密码不能与当前密码相同");
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError("UNAUTHORIZED", "当前密码不正确");
  }

  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

/**
 * 清空登录限流状态，仅用于单元测试。
 * @returns 无
 */
export function resetLoginRateLimit(): void {
  loginFailures.clear();
  usernameFailures.clear();
}
