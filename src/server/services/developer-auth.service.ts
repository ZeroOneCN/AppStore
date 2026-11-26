import { createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "../db";
import { LOGIN_RATE_LIMIT, SESSION_TTL_SECONDS } from "../infra/constants";
import { getEnv } from "../infra/env";
import { AppError } from "../infra/errors";
import { verifyPassword } from "./auth.service";

/** 开发者会话载荷 */
export type DeveloperSessionPayload = {
  sub: string;
  username: string;
  role: "developer";
};

/** 开发者登录失败计数 */
const failures = new Map<string, { count: number; resetAt: number }>();

/**
 * 派生开发者会话密钥，与管理员密钥隔离（管理员令牌无法通过开发者校验）。
 * @returns 32 字节 HS256 密钥
 */
function developerKey(): Uint8Array {
  return createHash("sha256").update(`${getEnv().SESSION_SECRET}|developer`).digest();
}

/**
 * 检查该客户端是否已被限流。
 * @param clientKey 客户端标识（IP）
 * @throws AppError 超过失败次数时抛出 RATE_LIMITED
 */
function assertNotRateLimited(clientKey: string): void {
  const record = failures.get(clientKey);
  if (!record) return;
  if (Date.now() >= record.resetAt) {
    failures.delete(clientKey);
    return;
  }
  if (record.count >= LOGIN_RATE_LIMIT.maxFailures) {
    throw new AppError("RATE_LIMITED", "尝试次数过多，请 5 分钟后再试");
  }
}

/**
 * 记录一次开发者登录失败。
 * @param clientKey 客户端标识
 * @returns 无
 */
function recordFailure(clientKey: string): void {
  const now = Date.now();
  const record = failures.get(clientKey);
  if (!record || now >= record.resetAt) {
    failures.set(clientKey, { count: 1, resetAt: now + LOGIN_RATE_LIMIT.windowMs });
    return;
  }
  record.count += 1;
}

/**
 * 签发开发者会话令牌。
 * @param developer 开发者标识与用户名
 * @param now 当前毫秒时间戳，便于测试注入
 * @returns JWT 字符串
 */
export async function createDeveloperSessionToken(
  developer: { id: string; username: string },
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new SignJWT({ sub: developer.id, username: developer.username, role: "developer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_TTL_SECONDS)
    .sign(developerKey());
}

/**
 * 校验开发者会话令牌。
 * @param token JWT 字符串
 * @returns 开发者会话载荷
 * @throws AppError 令牌无效、过期或角色不符时抛出 UNAUTHORIZED
 */
export async function verifyDeveloperSessionToken(token: string): Promise<DeveloperSessionPayload> {
  try {
    const { payload } = await jwtVerify(token, developerKey(), { algorithms: ["HS256"] });
    if (
      payload.role !== "developer" ||
      typeof payload.sub !== "string" ||
      !payload.sub ||
      typeof payload.username !== "string"
    ) {
      throw new Error("invalid developer token");
    }
    return { sub: payload.sub, username: payload.username, role: "developer" };
  } catch {
    throw new AppError("UNAUTHORIZED", "登录状态无效或已过期，请重新登录");
  }
}

/**
 * 计算开发者会话 Cookie 的选项。
 * @returns Next.js 兼容的 Cookie 选项
 */
export function developerCookieOptions(): {
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
    secure: getEnv().BASE_URL.startsWith("https://"),
  };
}

/**
 * 开发者登录：校验限流、账号状态与密码。
 * @param username 用户名
 * @param password 明文密码
 * @param clientKey 客户端标识（IP）
 * @returns 会话令牌与开发者信息
 * @throws AppError 限流、账号不存在、已停用或密码错误时抛出
 */
export async function developerLogin(
  username: string,
  password: string,
  clientKey: string,
): Promise<{ token: string; developer: { id: string; username: string; displayName: string } }> {
  const key = `dev:${clientKey}`;
  assertNotRateLimited(key);

  const developer = await prisma.developer.findUnique({ where: { username } });
  const matched = developer ? await verifyPassword(password, developer.passwordHash) : false;

  if (!developer || !matched) {
    recordFailure(key);
    throw new AppError("UNAUTHORIZED", "用户名或密码错误");
  }
  if (developer.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "账号已停用，请联系管理员");
  }

  failures.delete(key);
  return {
    token: await createDeveloperSessionToken({ id: developer.id, username: developer.username }),
    developer: {
      id: developer.id,
      username: developer.username,
      displayName: developer.displayName,
    },
  };
}

/**
 * 清空开发者登录限流状态，仅用于单元测试。
 * @returns 无
 */
export function resetDeveloperLoginRateLimit(): void {
  failures.clear();
}
