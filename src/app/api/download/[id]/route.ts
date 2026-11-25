import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { prisma } from "@/server/db";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logger } from "@/server/infra/logger";
import { resolveStoredPath } from "@/server/infra/paths";
import { getReleaseWithApp } from "@/server/services/release.service";
import { verifyDownloadSignature } from "@/server/services/signing.service";

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
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    verifyDownloadSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"));

    const release = await getReleaseWithApp(id);
    if (release.status === "DRAFT" || release.app.visibility !== "PUBLIC") {
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
    return toErrorResponse(error);
  }
}
