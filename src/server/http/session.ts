import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { AppError } from "@/server/infra/errors";
import { verifySessionToken, type SessionPayload } from "@/server/services/auth.service";

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
 * 提取登录限流使用的客户端标识。
 * @param request HTTP 请求
 * @returns 优先取 X-Forwarded-For 首个地址，其次 X-Real-IP，兜底 local
 */
export function clientKeyFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return request.headers.get("x-real-ip") ?? "local";
}
