import { cookies } from "next/headers";
import { DEVELOPER_SESSION_COOKIE, SESSION_COOKIE } from "@/server/infra/constants";
import { AppError } from "@/server/infra/errors";
import { verifySessionToken, type SessionPayload } from "@/server/services/auth.service";
import {
  verifyDeveloperSessionToken,
  type DeveloperSessionPayload,
} from "@/server/services/developer-auth.service";
import { assertDeveloperApp } from "@/server/services/developer.service";
import type { App } from "@prisma/client";
import { prisma } from "@/server/db";

/**
 * 校验管理后台会话，未登录或令牌失效时抛出 401。
 * @returns 会话载荷
 * @throws AppError 无 Cookie 或令牌无效时抛出 UNAUTHORIZED
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new AppError("UNAUTHORIZED", "请先登录管理后台");
  return verifySessionToken(token);
}

/**
 * 校验开发者门户会话：验签后回查账号，停用或删除后立即失效。
 * @returns 开发者会话载荷
 * @throws AppError 无 Cookie、令牌无效、账号不存在或已停用时抛出 UNAUTHORIZED
 */
export async function requireDeveloper(): Promise<DeveloperSessionPayload> {
  const store = await cookies();
  const token = store.get(DEVELOPER_SESSION_COOKIE)?.value;
  if (!token) throw new AppError("UNAUTHORIZED", "请先登录开发者门户");

  const payload = await verifyDeveloperSessionToken(token);
  const developer = await prisma.developer.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, status: true },
  });
  if (!developer || developer.status !== "ACTIVE") {
    throw new AppError("UNAUTHORIZED", "开发者账号不存在或已停用");
  }
  return { sub: developer.id, username: developer.username, role: "developer" };
}

/**
 * 校验开发者会话并确认应用归属。
 * @param appId 应用 ID
 * @returns 会话载荷与应用记录
 * @throws AppError 未登录或无权访问时抛出
 */
export async function requireDeveloperApp(
  appId: string,
): Promise<{ session: DeveloperSessionPayload; app: App }> {
  const session = await requireDeveloper();
  const app = await assertDeveloperApp(appId, session.sub);
  return { session, app };
}

/**
 * 提取登录限流使用的客户端标识。
 * @param request HTTP 请求
 * @returns 优先取 X-Forwarded-For 首个地址，其次 X-Real-IP，兜底 local
 */
export function clientKeyFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") ?? "local";
}
