import { NextResponse, type NextRequest } from "next/server";

/** 需要做跨站校验的写操作方法 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 校验写请求的 Origin 是否属于当前站点，防御跨站请求伪造。
 * 未携带 Origin 的客户端（curl、移动端、服务端调用）直接放行，保留 API 能力。
 * @param request 当前请求
 * @returns 放行响应或 403
 */
export function proxy(request: NextRequest): NextResponse {
  if (!MUTATING_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return NextResponse.next();
  }

  let originHost = "";
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "请求来源不合法" } },
      { status: 403 },
    );
  }

  const allowedHosts = new Set<string>();
  if (request.nextUrl.host) allowedHosts.add(request.nextUrl.host.toLowerCase());
  const host = request.headers.get("host");
  if (host) allowedHosts.add(host.split(",")[0]?.trim().toLowerCase() ?? "");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    allowedHosts.add(forwardedHost.split(",")[0]?.trim().toLowerCase() ?? "");
  }
  allowedHosts.delete("");

  if (!allowedHosts.has(originHost)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "跨站请求已被拒绝" } },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

/** 跳过静态资源，其余路径统一校验 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
