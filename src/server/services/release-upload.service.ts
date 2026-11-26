import type { App, Release } from "@prisma/client";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "../db";
import { getEnv } from "../infra/env";
import { AppError } from "../infra/errors";
import { logger } from "../infra/logger";
import { assertZipMagic, parseApk, streamApkToTemp } from "./apk.service";
import { updateAppIcon } from "./app.service";
import {
  assertVersionAvailable,
  createDraft,
  isReleaseFileReferenced,
  publish,
} from "./release.service";
import { moveApkToFinal, removeStoredFile, saveIcon } from "./storage.service";

/** 上传 APK 并创建版本的输入 */
export interface UploadReleaseInput {
  app: App;
  /** 上传者标记：admin 或 dev:<username> */
  actor: string;
  /** 二进制请求体 */
  body: ReadableStream<Uint8Array>;
  changelog: string;
  /** 上传成功后是否立即发布为当前版本 */
  autoPublish?: boolean;
}

/** 上传结果 */
export interface UploadReleaseResult {
  release: Release;
  parsed: {
    packageName: string;
    versionCode: number;
    versionName: string;
    minSdk: number | null;
    signFingerprint: string | null;
    iconBytes: number;
  };
  iconSaved: boolean;
}

/**
 * 上传 APK：流式落盘 → 解析 → 存储版本记录 →（可选）立即发布 → 补应用图标。
 * 任一环节失败时清理已落盘文件，避免残留。
 * @param input 应用、上传者、请求体、更新日志与是否自动发布
 * @returns 版本记录与解析结果
 * @throws AppError 应用类型不符、文件非法、版本冲突、发布失败时抛出
 */
export async function uploadApkRelease(input: UploadReleaseInput): Promise<UploadReleaseResult> {
  const { app, actor, body, changelog, autoPublish = false } = input;
  if (app.type !== "ANDROID") {
    throw new AppError("VALIDATION_FAILED", "网页作品不支持上传安装包");
  }

  const maxBytes = getEnv().MAX_APK_MB * 1024 * 1024;
  let tempPath: string | null = null;
  let storedPath: string | null = null;
  let createdRelease: Release | null = null;

  try {
    const uploaded = await streamApkToTemp(
      Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream),
      maxBytes,
    );
    tempPath = uploaded.tempPath;

    await assertZipMagic(tempPath);
    const parsed = await parseApk(tempPath);

    // 落盘前提前拦截重复版本，避免覆盖既有版本文件
    await assertVersionAvailable(app.id, parsed.versionCode);

    storedPath = await moveApkToFinal(tempPath, app.id, parsed.versionCode);
    tempPath = null;

    createdRelease = await createDraft({
      appId: app.id,
      packageName: parsed.packageName,
      versionCode: parsed.versionCode,
      versionName: parsed.versionName,
      minSdk: parsed.minSdk,
      signFingerprint: parsed.signFingerprint,
      filePath: storedPath,
      fileSize: uploaded.fileSize,
      sha256: uploaded.sha256,
      uploadedBy: actor,
      changelog,
    });

    if (autoPublish) {
      createdRelease = await publish(createdRelease.id);
    }

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

    return {
      release: createdRelease,
      parsed: {
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        signFingerprint: parsed.signFingerprint,
        iconBytes: parsed.iconBuffer?.byteLength ?? 0,
      },
      iconSaved,
    };
  } catch (error) {
    // 发布失败时删除刚创建的草稿，避免留下失效记录
    if (createdRelease) {
      await prismaReleaseCleanup(createdRelease.id);
    }
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
}

/**
 * 删除上传失败后残留的版本记录。
 * @param releaseId 版本 ID
 * @returns 无
 */
async function prismaReleaseCleanup(releaseId: string): Promise<void> {
  await prisma.release.delete({ where: { id: releaseId } }).catch(() => undefined);
}
