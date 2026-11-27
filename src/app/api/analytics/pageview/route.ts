import { clientIpFromRequest, recordPageView } from "@/server/services/analytics.service";
import { enforceRateLimit } from "@/server/http/rate-limit";

/**
 * 页面浏览上报：由前台信标调用，记录 PV/UV 与来源渠道。
 * @param request HTTP 请求
 * @returns 204 空响应
 */
export async function POST(request: Request): Promise<Response> {
  const limit = enforceRateLimit(`pageview:${clientIpFromRequest(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return new Response(null, {
      status: 429,
      headers: { "retry-after": String(limit.retryAfter) },
    });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!body || typeof body !== "object") {
    return new Response(null, { status: 400 });
  }

  const data = body as {
    path?: unknown;
    appId?: unknown;
    channel?: unknown;
    referrer?: unknown;
  };
  const path = typeof data.path === "string" ? data.path.trim() : "";
  if (!path) return new Response(null, { status: 400 });

  await recordPageView({
    request,
    path,
    appId: typeof data.appId === "string" && data.appId ? data.appId : null,
    channel: typeof data.channel === "string" ? data.channel : "",
    referer:
      typeof data.referrer === "string" && data.referrer
        ? data.referrer
        : request.headers.get("referer"),
  });

  return new Response(null, { status: 204 });
}
