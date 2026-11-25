import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { LOGIN_RATE_LIMIT, SESSION_TTL_SECONDS } from "../infra/constants";
import { getEnv } from "../infra/env";
import { AppError } from "../infra/errors";

const PASSWORD_COST = 12;

/** 登录失败计数：key 为客户端标识（IP），value 为次数与窗口过期时间 */
const loginFailures = new Map<string, { count: number; resetAt: number }>();

/** 会话载荷 */
export type SessionPayload = { username: string };

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
  return new SignJWT({ username })
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
    if (typeof payload.username !== "string" || !payload.username) {
      throw new Error("missing username");
    }
    return { username: payload.username };
  } catch {
    throw new AppError("UNAUTHORIZED", "登录状态无效或已过期，请重新登录");
  }
}

/**
 * 计算会话 Cookie 的选项。
 * @returns Next.js 兼容的 Cookie 选项
 */
export function sessionCookieOptions(): {
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
    // 内网明文 HTTP 试用期不启用 secure，切换 HTTPS 后自动生效
    secure: getEnv().BASE_URL.startsWith("https://"),
  };
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

  const user = await prisma.adminUser.findUnique({ where: { username } });
  const matched = user ? await verifyPassword(password, user.passwordHash) : false;

  if (!user || !matched) {
    recordFailure(clientKey);
    throw new AppError("UNAUTHORIZED", "用户名或密码错误");
  }

  clearFailures(clientKey);
  return createSessionToken(user.username);
}

/**
 * 清空登录限流状态，仅用于单元测试。
 * @returns 无
 */
export function resetLoginRateLimit(): void {
  loginFailures.clear();
}
