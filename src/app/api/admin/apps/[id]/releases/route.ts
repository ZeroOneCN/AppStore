import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { requireAdmin } from "@/server/http/session";
import { getEnv } from "@/server/infra/env";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logger } from "@/server/infra/logger";
import {
  assertZipMagic,
  parseApk,
  streamApkToTemp,
} from "@/server/services/apk.service";
import { getAppById, updateAppIcon } from "@/server/services/app.service";
import { logAudit } from "@/server/services/audit.service";
import {
  assertVersionAvailable,
  createDraft,
  isReleaseFileReferenced,
} from "@/server/services/release.service";
import { moveApkToFinal, removeStoredFile, saveIcon } from "@/server/services/storage.service";

/**
 * 安全解析 URL 编码的请求头值。
 * @param value 请求头原始值
 * @returns 解码后的文本，解码失败返回原文
 */
function decodeHeaderValue(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 上传 APK 并创建版本草稿。
 * 请求体为二进制流，边落盘边计算 SHA256；解析成功后移入正式目录并写入草稿。
 * @param request HTTP 请求，content-type 建议 application/octet-stream
 * @param context 路由参数，id 为应用 ID
 * @returns 版本草稿与解析结果
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAdmin();
  const { id } = await context.params;

  try {
    const app = await getAppById(id);
    if (app.type !== "ANDROID") {
      throw new AppError("VALIDATION_FAILED", "网页作品不支持上传安装包");
    }
    if (!request.body) {
      throw new AppError("VALIDATION_FAILED", "请求体为空，请以二进制流上传 APK");
    }

    const maxBytes = getEnv().MAX_APK_MB * 1024 * 1024;
    let tempPath: string | null = null;
    let storedPath: string | null = null;

    try {
      const uploaded = await streamApkToTemp(
        Readable.fromWeb(request.body as unknown as import("node:stream/web").ReadableStream),
        maxBytes,
      );
      tempPath = uploaded.tempPath;

      await assertZipMagic(tempPath);
      const parsed = await parseApk(tempPath);

      // 落盘前提前拦截重复版本，避免覆盖既有版本文件
      await assertVersionAvailable(app.id, parsed.versionCode);

      storedPath = await moveApkToFinal(tempPath, app.id, parsed.versionCode);
      tempPath = null;

      const draft = await createDraft({
        appId: app.id,
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        signFingerprint: parsed.signFingerprint,
        filePath: storedPath,
        fileSize: uploaded.fileSize,
        sha256: uploaded.sha256,
        changelog: decodeHeaderValue(request.headers.get("x-version-changelog")),
      });

      let iconSaved = false;
      if (!app.iconPath && parsed.iconBuffer) {
        try {
          await updateAppIcon(app.id, await saveIcon(parsed.iconBuffer, app.id));
          iconSaved = true;
        } catch (error) {
          // 图标保存失败不影响版本创建
          logger.warn("APK 内置图标保存失败", {
            appId: app.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await logAudit(
        session.username,
        "release.upload",
        `${app.name} v${draft.versionName}`,
        `${(uploaded.fileSize / 1024 / 1024).toFixed(1)} MB，版本号 ${draft.versionCode}`,
      );

      return Response.json(
        {
          release: draft,
          parsed: {
            packageName: parsed.packageName,
            versionCode: parsed.versionCode,
            versionName: parsed.versionName,
            minSdk: parsed.minSdk,
            signFingerprint: parsed.signFingerprint,
            iconBytes: parsed.iconBuffer?.byteLength ?? 0,
          },
          iconSaved,
        },
        { status: 201, headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      // 草稿创建失败时回滚本次落盘的 APK；若该路径仍被既有版本引用则保留
      if (storedPath && !(await isReleaseFileReferenced(storedPath).catch(() => true))) {
        await removeStoredFile(storedPath).catch(() => undefined);
      }
      throw error;
    } finally {
      if (tempPath) {
        await fs.rm(tempPath, { force: true }).catch(() => undefined);
      }
    }
  } catch (error) {
    return toErrorResponse(error);
  }
}
