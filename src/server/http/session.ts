import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { AppError } from "@/server/infra/errors";
import { verifySessionToken, type SessionPayload } from "@/server/services/auth.service";
import {
  verifyDeveloperSessionToken,
  type DeveloperSessionPayload,
} from "@/server/services/developer-auth.service";
import { assertDeveloperApp } from "@/server/services/developer.service";
import type { App } from "@prisma/client";
import { prisma } from "@/server/db";

/** 统一会话信息：管理员与开发者共用 Cookie，仅以角色区分权限 */
export type SessionInfo =
  | { role: "admin"; sub: "admin"; username: string }
  | { role: "developer"; sub: string; username: string };

/**
 * 读取当前会话（管理员优先，其次开发者），仅验签不查询账号状态。
 * 用于前台导航判断登录态等只读场景。
 * @returns 会话信息，未登录或令牌无效时返回 null
 */
export async function getSession(): Promise<SessionInfo | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = await verifySessionToken(token);
    return { role: "admin", sub: "admin", username: payload.username };
  } catch {
    // 非管理员令牌，继续尝试开发者令牌
  }

  try {
    const payload = await verifyDeveloperSessionToken(token);
    return { role: "developer", sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

/**
 * 校验管理后台会话，未登录、令牌失效或角色不符时抛出 401。
 * @returns 管理员会话载荷
 * @throws AppError 无 Cookie 或令牌无效时抛出 UNAUTHORIZED
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new AppError("UNAUTHORIZED", "请先登录管理后台");
  return verifySessionToken(token);
}

/**
 * 校验开发者会话：统一 Cookie 验签后回查账号，停用或删除后立即失效。
 * @returns 开发者会话载荷
 * @throws AppError 无 Cookie、令牌无效、角色不符、账号不存在或已停用时抛出 UNAUTHORIZED
 */
export async function requireDeveloper(): Promise<DeveloperSessionPayload> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) throw new AppError("UNAUTHORIZED", "请先登录开发者账号");

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
 * 优先使用反向代理写入的 X-Real-IP；否则取 X-Forwarded-For 最后一跳（由最近的代理追加），
 * 避免攻击者伪造最左侧地址绕过限流。
 * @param request HTTP 请求
 * @returns 客户端标识
 */
export function clientKeyFrom(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const nearest = hops[hops.length - 1];
    if (nearest) return nearest;
  }

  return "local";
}
