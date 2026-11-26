import type { App, Release } from "@prisma/client";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "../db";
import { AppError } from "../infra/errors";
import { logger } from "../infra/logger";
import { resolveStoredPath } from "../infra/paths";
import { assertZipMagic, parseApk, streamApkToTemp } from "./apk.service";
import {
  loadStagedUpload,
  promoteStagedApk,
  readStagedIcon,
  removeStagedUpload,
} from "./apk-staging.service";
import { updateAppIcon } from "./app.service";
import {
  assertVersionAvailable,
  createDraft,
  isReleaseFileReferenced,
  overwriteRelease,
  publish,
} from "./release.service";
import { getSiteSettings } from "./settings.service";
import { moveApkToFinal, removeStoredFile, saveIcon } from "./storage.service";

/** 上传 APK 并创建版本的输入 */
export interface UploadReleaseInput {
  app: App;
  /** 上传者标记：admin 或 dev:<username> */
  actor: string;
  /** 二进制请求体；与 stagedToken 二选一 */
  body?: ReadableStream<Uint8Array>;
  /** 步骤一暂存上传得到的 token，用于步骤三直接提交 */
  stagedToken?: string;
  changelog: string;
  /** 上传成功后是否立即发布为当前版本 */
  autoPublish?: boolean;
  /** 版本号已存在时是否用本次安装包覆盖 */
  overwrite?: boolean;
  /** 选择的图标 ID；空字符串表示保留原图标，缺省使用默认最高清图标 */
  iconId?: string | null;
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
  /** 本次是否覆盖了同版本号 */
  overwritten: boolean;
}

/** 覆盖前对旧安装包的备份，用于失败回滚 */
interface FileBackup {
  backupPath: string;
  targetPath: string;
}

/**
 * 上传 APK：流式落盘或读取暂存会话 → 校验 → 存储版本记录 →（可选）立即发布 → 更新应用图标。
 * 版本号已存在时：勾选覆盖则替换文件与包信息并保留版本 ID，否则返回版本冲突。
 * 任一环节失败时清理已落盘文件并还原被覆盖的旧安装包。
 * @param input 应用、上传者、请求体或暂存 token、更新日志、发布/覆盖选项与图标选择
 * @returns 版本记录、解析结果与是否覆盖
 * @throws AppError 应用类型不符、文件非法、版本冲突、发布失败时抛出
 */
export async function uploadApkRelease(input: UploadReleaseInput): Promise<UploadReleaseResult> {
  const {
    app,
    actor,
    body,
    stagedToken,
    changelog,
    autoPublish = false,
    overwrite = false,
    iconId,
  } = input;

  if (app.type !== "ANDROID") {
    throw new AppError("VALIDATION_FAILED", "网页作品不支持上传安装包");
  }

  const staged = stagedToken ? await loadStagedUpload(stagedToken) : null;
  if (staged && staged.actor !== actor) {
    throw new AppError("FORBIDDEN", "上传会话不属于当前账号，请重新选择安装包");
  }

  let tempPath: string | null = null;
  let storedPath: string | null = null;
  /** 本次新建的草稿 ID，失败时用于回滚数据库记录 */
  let createdDraftId: string | null = null;
  let resultRelease: Release | null = null;
  let fileBackup: FileBackup | null = null;

  try {
    let parsed: {
      packageName: string;
      versionCode: number;
      versionName: string;
      minSdk: number | null;
      signFingerprint: string | null;
      iconBuffer: Buffer | null;
    };
    let fileSize: number;
    let sha256: string;

    if (staged) {
      parsed = { ...staged.parsed, iconBuffer: null };
      fileSize = staged.fileSize;
      sha256 = staged.sha256;
    } else {
      if (!body) {
        throw new AppError("VALIDATION_FAILED", "缺少安装包内容，请重新上传");
      }
      const { maxApkMb } = await getSiteSettings();
      const uploaded = await streamApkToTemp(
        Readable.fromWeb(body as unknown as import("node:stream/web").ReadableStream),
        maxApkMb * 1024 * 1024,
      );
      tempPath = uploaded.tempPath;
      await assertZipMagic(tempPath);
      parsed = await parseApk(tempPath);
      fileSize = uploaded.fileSize;
      sha256 = uploaded.sha256;
    }

    // 覆盖模式下先查询同版本号记录；普通模式沿用唯一性校验并提示覆盖入口
    const existing = overwrite
      ? await prisma.release.findFirst({
          where: { appId: app.id, versionCode: parsed.versionCode },
        })
      : null;
    if (!overwrite) {
      await assertVersionAvailable(app.id, parsed.versionCode);
    }
    if (existing?.status === "ARCHIVED" && autoPublish) {
      throw new AppError(
        "VALIDATION_FAILED",
        "该版本已归档，覆盖后不能直接发布，请取消「上传后立即发布」后重试",
      );
    }

    // 覆盖前备份旧文件，任意一步失败都能还原上一份安装包
    if (existing) {
      const targetPath = resolveStoredPath(existing.filePath);
      const backupPath = `${targetPath}.bak-${Date.now()}`;
      const copied = await fs
        .copyFile(targetPath, backupPath)
        .then(() => true)
        .catch(() => false);
      if (copied) fileBackup = { backupPath, targetPath };
    }

    if (staged) {
      storedPath = await promoteStagedApk(staged, app.id, parsed.versionCode);
    } else {
      if (!tempPath) {
        throw new AppError("VALIDATION_FAILED", "缺少安装包内容，请重新上传");
      }
      storedPath = await moveApkToFinal(tempPath, app.id, parsed.versionCode);
      tempPath = null;
    }

    if (existing) {
      resultRelease = await overwriteRelease({
        releaseId: existing.id,
        versionName: parsed.versionName,
        filePath: storedPath,
        fileSize,
        sha256,
        signFingerprint: parsed.signFingerprint,
        minSdk: parsed.minSdk,
        changelog,
        uploadedBy: actor,
        publish: autoPublish,
      });
      // 旧版本文件路径与新文件不同时清理历史文件
      if (existing.filePath !== storedPath) {
        await removeStoredFile(existing.filePath).catch(() => undefined);
      }
    } else {
      resultRelease = await createDraft({
        appId: app.id,
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        signFingerprint: parsed.signFingerprint,
        filePath: storedPath,
        fileSize,
        sha256,
        uploadedBy: actor,
        changelog,
      });
      createdDraftId = resultRelease.id;

      if (autoPublish) {
        resultRelease = await publish(resultRelease.id);
      }
    }

    // 覆盖成功后备份即可删除
    if (fileBackup) {
      await fs.rm(fileBackup.backupPath, { force: true }).catch(() => undefined);
      fileBackup = null;
    }

    // 图标：显式选择则用所选，缺省用本次 APK 的最高清图标；空字符串表示保留原图标
    let iconBuffer: Buffer | null = null;
    if (iconId !== "") {
      if (staged) {
        iconBuffer =
          (await readStagedIcon(staged, iconId ?? null)) ??
          (await readStagedIcon(staged, staged.icons[0]?.id ?? null));
      } else {
        iconBuffer = parsed.iconBuffer;
      }
    }

    let iconSaved = false;
    if (iconBuffer) {
      try {
        await updateAppIcon(app.id, await saveIcon(iconBuffer, app.id));
        iconSaved = true;
      } catch (error) {
        // 图标保存失败不影响版本创建
        logger.warn("APK 图标保存失败", {
          appId: app.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (staged) {
      await removeStagedUpload(staged.token);
    }

    return {
      release: resultRelease,
      parsed: {
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        signFingerprint: parsed.signFingerprint,
        iconBytes: iconBuffer?.byteLength ?? 0,
      },
      iconSaved,
      overwritten: Boolean(existing),
    };
  } catch (error) {
    // 发布失败时删除刚创建的草稿，避免留下失效记录
    if (createdDraftId) {
      await prismaReleaseCleanup(createdDraftId);
    }
    // 覆盖失败时还原旧安装包，避免线上版本文件被半成品替换
    if (fileBackup) {
      await fs.rm(fileBackup.targetPath, { force: true }).catch(() => undefined);
      const restored = await fs
        .rename(fileBackup.backupPath, fileBackup.targetPath)
        .then(() => true)
        .catch(() => false);
      if (!restored) {
        await fs.copyFile(fileBackup.backupPath, fileBackup.targetPath).catch(() => undefined);
        await fs.rm(fileBackup.backupPath, { force: true }).catch(() => undefined);
      }
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
