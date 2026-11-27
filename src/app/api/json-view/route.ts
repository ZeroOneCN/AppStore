/** 禁止通过 JSON 视图代理访问的路径：二进制下载与视图自身 */
const BLOCKED_PREFIXES = ["/api/download/", "/api/assets/", "/api/json-view"];

/**
 * HTML 转义，避免 JSON 内容破坏页面结构。
 * @param value 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/**
 * JSON 语法高亮：先转义 HTML 特殊字符，再按 token 包裹颜色类名。
 * @param json 已格式化的 JSON 文本
 * @returns 高亮后的 HTML 片段
 */
function highlightJson(json: string): string {
  const escaped = escapeHtml(json);
  return escaped.replace(
    /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    (match, text: string | undefined, colon: string | undefined, literal: string | undefined) => {
      if (text) {
        const kind = colon ? "key" : "str";
        return `<span class="tok-${kind}">${text}</span>${colon ?? ""}`;
      }
      if (literal) {
        return `<span class="tok-${literal === "null" ? "null" : "bool"}">${match}</span>`;
      }
      return `<span class="tok-num">${match}</span>`;
    },
  );
}

/**
 * 根据 HTTP 状态码选择徽标配色。
 * @param status 状态码
 * @returns 样式类名
 */
function statusTone(status: number): string {
  if (status >= 200 && status < 300) return "ok";
  if (status >= 400 && status < 500) return "warn";
  return "err";
}

/**
 * 渲染美化后的 JSON 查看页。
 * @param options 页面数据
 * @param options.target 原始接口路径（含查询参数）
 * @param options.status HTTP 状态码
 * @param options.statusText 状态描述
 * @param options.body 美化后的 JSON 文本
 * @param options.rawUrl 原始 JSON 地址
 * @param options.message 可选提示，例如非 JSON 响应
 * @returns 完整 HTML 文档
 */
function renderPage(options: {
  target: string;
  status: number;
  statusText: string;
  body: string;
  rawUrl: string;
  message?: string;
}): string {
  const { target, status, statusText, body, rawUrl, message } = options;
  const title = `GET ${target}`;
  const tone = statusTone(status);
  const content = message
    ? `<p class="notice">${escapeHtml(message)}</p>`
    : `<pre class="json">${highlightJson(body)}</pre>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · JSON 视图</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0 16px 48px;
    background: #f5f6f8;
    color: #16181d;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  a { color: #1e51ee; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .shell { max-width: 1080px; margin: 0 auto; }
  .topbar {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 18px 2px 14px; flex-wrap: wrap;
  }
  .brand { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .brand .dot {
    display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 7px;
    background: linear-gradient(135deg, #1e51ee, #6d8bff); color: #fff; font-size: 12px;
  }
  .nav { display: flex; gap: 14px; font-size: 12px; color: #5b6373; }
  .meta {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    background: #fff; border: 1px solid rgba(15, 23, 42, 0.07); border-radius: 14px 14px 0 0;
    padding: 12px 14px; border-bottom: 0;
  }
  .method {
    background: rgba(30, 81, 238, 0.1); color: #1e51ee; font-weight: 700; font-size: 11px;
    letter-spacing: 0.06em; padding: 4px 8px; border-radius: 6px;
  }
  .path {
    flex: 1 1 240px; min-width: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px; color: #2a2f3a; word-break: break-all;
  }
  .status { font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 6px; white-space: nowrap; }
  .status.ok { background: rgba(16, 163, 74, 0.1); color: #0f7b3f; }
  .status.warn { background: rgba(217, 119, 6, 0.12); color: #a86206; }
  .status.err { background: rgba(220, 38, 38, 0.1); color: #b91c1c; }
  .raw { font-size: 12px; white-space: nowrap; }
  .card {
    background: #fff; border: 1px solid rgba(15, 23, 42, 0.07); border-radius: 0 0 14px 14px;
    padding: 14px; box-shadow: 0 10px 30px -24px rgba(15, 23, 42, 0.45);
  }
  .json {
    margin: 0; white-space: pre; overflow-x: auto; tab-size: 2;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 12.5px; line-height: 1.72; color: #1f2430;
  }
  .tok-key { color: #1e51ee; }
  .tok-str { color: #0f7b4f; }
  .tok-num { color: #b45309; }
  .tok-bool { color: #7c3aed; }
  .tok-null { color: #8b93a1; }
  .notice { margin: 0; color: #a86206; font-size: 13px; line-height: 1.7; }
  .tip { margin: 14px 2px 0; font-size: 12px; line-height: 1.7; color: #7b8391; }
  @media (max-width: 640px) {
    body { padding: 0 12px 36px; }
    .topbar { padding-top: 14px; }
    .json { font-size: 12px; }
  }
</style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="brand"><span class="dot">A</span>应用仓库 · JSON 视图</div>
      <nav class="nav">
        <a href="/">首页</a>
        <a href="/docs">接口文档</a>
        <a href="/api/openapi">OpenAPI</a>
      </nav>
    </div>
    <div class="meta">
      <span class="method">GET</span>
      <code class="path">${escapeHtml(target)}</code>
      <span class="status ${tone}">${status} ${escapeHtml(statusText)}</span>
      <a class="raw" href="${escapeHtml(rawUrl)}">原始 JSON</a>
    </div>
    <div class="card">${content}</div>
    <p class="tip">浏览器直接访问接口地址时自动美化展示；程序调用（Accept 不含 text/html）或追加 <code>?format=json</code> 时返回原始 JSON。</p>
  </div>
</body>
</html>`;
}

/**
 * 构造 HTML 响应。
 * @param html 页面内容
 * @param status 状态码
 * @returns HTTP 响应
 */
function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * JSON 美化视图：代理内部 JSON 接口并以带语法高亮的页面展示。
 * 由 proxy 在浏览器访问 /api/* 时重写到本路由，程序调用不经过这里。
 * @param request HTTP 请求，target 参数为目标接口路径
 * @returns 美化后的 HTML 或错误提示
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // proxy 改写时通过请求头传递目标路径，直接访问时也支持 ?target= 参数
  const target = request.headers.get("x-json-view-target") ?? url.searchParams.get("target") ?? "";

  if (!target.startsWith("/api/") || target.startsWith("//")) {
    return htmlResponse(renderPage({
      target: "/api/json-view",
      status: 400,
      statusText: "Bad Request",
      body: "",
      rawUrl: "/api/json-view",
      message: "target 参数必须是以 /api/ 开头的站内路径",
    }), 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target, url.origin);
  } catch {
    return htmlResponse(renderPage({
      target,
      status: 400,
      statusText: "Bad Request",
      body: "",
      rawUrl: target,
      message: "target 参数格式不正确",
    }), 400);
  }

  if (targetUrl.origin !== url.origin || BLOCKED_PREFIXES.some((prefix) => targetUrl.pathname.startsWith(prefix))) {
    return htmlResponse(renderPage({
      target,
      status: 400,
      statusText: "Bad Request",
      body: "",
      rawUrl: target,
      message: "该地址不支持在 JSON 视图中查看",
    }), 400);
  }

  // 转发登录会话，便于查看后台接口的返回结构
  const headers = new Headers({ accept: "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, { headers, cache: "no-store", redirect: "manual" });
  } catch {
    return htmlResponse(renderPage({
      target,
      status: 502,
      statusText: "Bad Gateway",
      body: "",
      rawUrl: `${target}${target.includes("?") ? "&" : "?"}format=json`,
      message: "无法连接目标接口，请稍后重试",
    }), 502);
  }

  const rawUrl = new URL(targetUrl);
  rawUrl.searchParams.set("format", "json");

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return htmlResponse(renderPage({
      target,
      status: upstream.status,
      statusText: upstream.statusText,
      body: "",
      rawUrl: rawUrl.toString(),
      message: "该地址不是 JSON 接口，未做美化处理",
    }), upstream.status);
  }

  const text = await upstream.text();
  let pretty = text;
  try {
    pretty = JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    // 非 JSON 内容按原始文本展示，避免白屏
  }

  return htmlResponse(renderPage({
    target,
    status: upstream.status,
    statusText: upstream.statusText,
    body: pretty,
    rawUrl: rawUrl.toString(),
  }), upstream.status);
}
