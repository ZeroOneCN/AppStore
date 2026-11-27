import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { AppError, isAppError, toErrorResponse } from "@/server/infra/errors";
import { logger } from "@/server/infra/logger";
import { resolveStoredPath } from "@/server/infra/paths";
import { SIGN_TTL_SECONDS } from "@/server/infra/constants";
import { getReleaseWithApp } from "@/server/services/release.service";
import { verifyDownloadSignature } from "@/server/services/signing.service";

/**
 * 判断是否为浏览器页面跳转请求，用于返回友好的 HTML 错误页。
 * @param request HTTP 请求
 * @returns 浏览器导航返回 true
 */
function wantsHtml(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

/**
 * 转义 HTML 特殊字符，避免应用名称注入。
 * @param value 原始文本
 * @returns 转义后的文本
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 渲染下载链接失效页面：给出原因、有效期说明与返回应用详情的入口。
 * 仅公开应用会展示具体名称与详情链接，避免泄露私有应用信息。
 * @param error 捕获的异常
 * @param releaseId 版本 ID
 * @returns HTML 错误响应
 */
async function renderDownloadError(error: unknown, releaseId: string): Promise<Response> {
  const appError = isAppError(error) ? error : null;
  const status = appError?.status ?? 500;
  const minutes = Math.max(1, Math.round(SIGN_TTL_SECONDS / 60));

  const title =
    appError?.code === "LINK_EXPIRED"
      ? "下载链接已过期"
      : appError?.code === "NOT_FOUND"
        ? "下载链接已失效"
        : appError?.code === "FORBIDDEN"
          ? "下载链接无效"
          : appError?.code === "VALIDATION_FAILED"
            ? "下载链接不完整"
            : "暂时无法下载";

  const description =
    appError?.code === "LINK_EXPIRED"
      ? `为保护安装包安全，下载链接仅在 ${minutes} 分钟内有效。请返回应用详情页重新点击下载获取新链接。`
      : appError?.code === "NOT_FOUND"
        ? "该版本可能已被删除或不再提供下载，请返回应用详情页查看最新版本。"
        : appError?.code === "FORBIDDEN"
          ? "链接签名校验未通过，可能已被修改或不完整。请返回应用详情页重新获取下载链接。"
          : appError?.code === "VALIDATION_FAILED"
            ? "链接缺少必要的下载参数，请返回应用详情页重新获取下载链接。"
            : "服务器暂时无法处理该下载请求，请稍后重试或返回应用详情页重新下载。";

  // 公开应用提供返回详情入口；私有或已删除应用保持通用提示
  let appLink: { name: string; href: string } | null = null;
  try {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        status: true,
        app: { select: { name: true, slug: true, visibility: true } },
      },
    });
    if (release && release.app.visibility === "PUBLIC" && release.status !== "DRAFT") {
      appLink = { name: release.app.name, href: `/apps/${release.app.slug}` };
    }
  } catch {
    // 查询失败时退回通用页面
  }

  const primaryHref = appLink?.href ?? "/apps";
  const primaryLabel = appLink ? `返回「${escapeHtml(appLink.name)}」` : "浏览应用列表";

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} · 应用仓库</title>
<style>
  :root { color-scheme: light dark; --bg: #f5f6fa; --card: rgba(255,255,255,.92); --text: #17181c; --muted: #6b7280; --border: rgba(0,0,0,.08); --brand: #1e51ee; --brand-weak: rgba(30,81,238,.08); }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d0d0f; --card: rgba(28,28,30,.92); --text: #f5f5f7; --muted: #9ca3af; --border: rgba(255,255,255,.1); --brand-weak: rgba(99,132,255,.14); } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(1200px 600px at 50% -10%, var(--brand-weak), transparent 60%), var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; -webkit-font-smoothing: antialiased; }
  .card { width: 100%; max-width: 440px; padding: 36px 30px; text-align: center; background: var(--card); border: 1px solid var(--border); border-radius: 26px; box-shadow: 0 24px 60px -30px rgba(15,23,42,.35); backdrop-filter: blur(16px); }
  .badge { width: 64px; height: 64px; margin: 0 auto 20px; display: grid; place-items: center; border-radius: 20px; color: var(--brand); background: var(--brand-weak); }
  h1 { margin: 0 0 10px; font-size: 22px; letter-spacing: -.02em; }
  p { margin: 0 auto; max-width: 340px; font-size: 14px; line-height: 1.75; color: var(--muted); }
  .actions { margin-top: 26px; display: grid; gap: 10px; }
  a { display: flex; align-items: center; justify-content: center; height: 46px; border-radius: 14px; font-size: 15px; font-weight: 600; text-decoration: none; transition: .2s ease; }
  .primary { color: #fff; background: linear-gradient(135deg, #2f6bff, #1e51ee); box-shadow: 0 14px 28px -16px rgba(30,81,238,.9); }
  .primary:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .secondary { color: var(--text); border: 1px solid var(--border); }
  .secondary:hover { background: var(--brand-weak); }
  .hint { margin-top: 18px; font-size: 12px; color: var(--muted); }
</style>
</head>
<body>
  <main class="card">
    <div class="badge" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3v10" /><path d="m8 9 4 4 4-4" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /><path d="m3 3 18 18" />
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${description}</p>
    <div class="actions">
      <a class="primary" href="${primaryHref}">${primaryLabel}</a>
      <a class="secondary" href="/">返回首页</a>
    </div>
    <p class="hint">若多次失败，请稍后重试或联系管理员</p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}

/**
 * 解析单段 Range 请求头。
 * @param header Range 头内容
 * @param size 文件总大小
 * @returns 区间、无 Range 返回 null、非法返回 "invalid"
 */
function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return "invalid";

  let start: number;
  let end: number;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return "invalid";
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }

  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start > end || start >= size) {
    return "invalid";
  }
  return { start, end };
}

/**
 * 下载计数自增，失败只记录日志，不影响下载本身。
 * @param appId 应用 ID
 * @param releaseId 版本 ID
 * @returns 无
 */
function incrementDownloadCounters(appId: string, releaseId: string): void {
  void Promise.all([
    prisma.app.update({ where: { id: appId }, data: { downloadCount: { increment: 1 } } }),
    prisma.release.update({ where: { id: releaseId }, data: { downloadCount: { increment: 1 } } }),
  ]).catch((error: unknown) => {
    logger.warn("下载计数更新失败", {
      appId,
      releaseId,
      error: error instanceof Error ? error.message : String(error),
    });
  });
}

/**
 * APK 下载接口：校验签名、支持 Range 断点续传，并在完整请求时计数。
 * @param request HTTP 请求
 * @param context 路由参数
 * @returns APK 流或错误响应
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  try {
    const url = new URL(request.url);
    verifyDownloadSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"));

    const release = await getReleaseWithApp(id);
    // 私有应用不进入前台列表，但持有签名下载链接的调用方仍可下载以完成更新
    if (release.status === "DRAFT") {
      throw new AppError("NOT_FOUND", "版本不存在或未公开");
    }

    const absolutePath = resolveStoredPath(release.filePath);
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) {
      throw new AppError("NOT_FOUND", "安装包文件不存在，请联系管理员");
    }

    const size = stat.size;
    const range = parseRange(request.headers.get("range"), size);
    const fileName = `${release.app.name}-${release.versionName}.apk`;

    const headers = new Headers({
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="download.apk"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });

    if (range === "invalid") {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    const start = range ? range.start : 0;
    const end = range ? range.end : size - 1;
    headers.set("Content-Length", String(end - start + 1));
    if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);

    if (start === 0) incrementDownloadCounters(release.appId, release.id);

    const stream = Readable.toWeb(createReadStream(absolutePath, { start, end })) as ReadableStream<Uint8Array>;
    return new Response(stream, { status: range ? 206 : 200, headers });
  } catch (error) {
    // 浏览器直接打开失效链接时返回友好页面，接口调用仍返回 JSON
    if (wantsHtml(request)) {
      return renderDownloadError(error, id);
    }
    return toErrorResponse(error);
  }
}
