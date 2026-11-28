import { NextResponse, type NextRequest } from "next/server";

/** 需要做跨站校验的写操作方法 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** 不做 JSON 美化视图的路径：文件流、视图自身与自带 HTML 的接口文档 */
const JSON_VIEW_EXCLUDED = ["/api/download/", "/api/assets/", "/api/json-view", "/api/openapi"];

/**
 * 判断浏览器直接访问的 JSON 接口是否需要转为美化视图。
 * 程序调用通常不发送 text/html，因此不会被改写；加 ?format=json 可强制原始 JSON。
 * @param request 当前请求
 * @returns 需要美化返回 true
 */
function shouldRenderJsonView(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  if (!pathname.startsWith("/api/")) return false;
  if (JSON_VIEW_EXCLUDED.some((prefix) => pathname.startsWith(prefix))) return false;
  if (searchParams.get("format") === "json") return false;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html");
}

/**
 * 校验写请求的 Origin 是否属于当前站点，防御跨站请求伪造。
 * 未携带 Origin 的客户端（curl、移动端、服务端调用）直接放行，保留 API 能力。
 * @param request 当前请求
 * @returns 放行响应或 403
 */
export function proxy(request: NextRequest): NextResponse {
  // 浏览器访问 JSON 接口时重写到美化视图，接口本身仍按原始 JSON 输出
  if (request.method === "GET" && shouldRenderJsonView(request)) {
    const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    // 只转发会话与目标路径，避免把 Host、Connection 等逐跳头带入内部改写
    const headers = new Headers();
    const cookie = request.headers.get("cookie");
    if (cookie) headers.set("cookie", cookie);
    headers.set("x-json-view-target", target);
    return NextResponse.rewrite(new URL("/api/json-view", request.url), {
      request: { headers },
    });
  }

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

/** 跳过静态资源与大文件上传路由：上传路由直接流式落盘，避免代理缓冲请求体（路由内自行校验 Origin） */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|api/admin/apps/[^/]+/releases|api/dev/apps/[^/]+/releases|api/admin/apk/stage|api/dev/apk/stage|api/admin/apps/with-apk|api/dev/apps/with-apk).*)",
  ],
};
