import { AppError } from "../infra/errors";

/**
 * 校验写请求的 Origin 是否属于当前站点。
 * 用于被代理匹配器排除的大文件上传路由，避免 CSRF 防护出现缺口。
 * 未携带 Origin 的调用（curl、服务端调用）直接放行。
 * @param request HTTP 请求
 * @throws AppError Origin 非法或跨站时抛出 FORBIDDEN
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    throw new AppError("FORBIDDEN", "请求来源不合法");
  }

  const allowedHosts = new Set<string>();
  try {
    allowedHosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // request.url 异常时忽略该来源
  }
  const host = request.headers.get("host");
  if (host) allowedHosts.add(host.split(",")[0]?.trim().toLowerCase() ?? "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    allowedHosts.add(forwardedHost.split(",")[0]?.trim().toLowerCase() ?? "");
  }
  allowedHosts.delete("");

  if (!allowedHosts.has(originHost)) {
    throw new AppError("FORBIDDEN", "跨站请求已被拒绝");
  }
}
