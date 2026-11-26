import type { App, Release } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../infra/errors";
import { signDownloadPath } from "./signing.service";
import { removeStoredFile } from "./storage.service";

/** 创建版本草稿的输入 */
export interface CreateDraftInput {
  appId: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  signFingerprint: string | null;
  /** 以存储根目录为基准的相对路径 */
  filePath: string;
  fileSize: number;
  sha256: string;
  /** 上传者标记：admin 或 dev:<username> */
  uploadedBy?: string | null;
  changelog?: string;
  forceUpdate?: boolean;
  minSupportedVersionCode?: number | null;
}

/** 覆盖既有版本的输入 */
export interface OverwriteReleaseInput {
  /** 待覆盖版本 ID */
  releaseId: string;
  versionName: string;
  /** 以存储根目录为基准的相对路径 */
  filePath: string;
  fileSize: number;
  sha256: string;
  signFingerprint: string | null;
  minSdk: number | null;
  changelog?: string;
  /** 上传者标记：admin 或 dev:<username> */
  uploadedBy?: string | null;
  /** 覆盖后是否立即发布为当前版本 */
  publish: boolean;
}

/** 更新检查结果 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  forceUpdate: boolean;
  reason: "NOT_FOUND" | null;
  latest: {
    versionName: string;
    versionCode: number;
    changelog: string;
    fileSize: number;
    sha256: string;
    minSdk: number | null;
    minSupportedVersionCode: number | null;
    downloadUrl: string;
    publishedAt: string | null;
  } | null;
}

/**
 * 创建版本草稿，校验包名一致与版本号唯一。
 * @param input 版本字段
 * @returns 新建的版本记录
 * @throws AppError 应用不存在、类型不符、包名不一致或版本号重复时抛出
 */
export async function createDraft(input: CreateDraftInput): Promise<Release> {
  const app = await prisma.app.findUnique({ where: { id: input.appId } });
  if (!app) throw new AppError("NOT_FOUND", "应用不存在");
  if (app.type !== "ANDROID") throw new AppError("VALIDATION_FAILED", "网页作品不支持发布版本");
  if (app.packageName !== input.packageName) {
    throw new AppError(
      "PACKAGE_MISMATCH",
      `APK 包名（${input.packageName}）与应用记录的包名（${app.packageName ?? "未设置"}）不一致`,
    );
  }

  const duplicate = await prisma.release.findFirst({
    where: { appId: input.appId, versionCode: input.versionCode },
  });
  if (duplicate) {
    throw new AppError("VERSION_CONFLICT", `版本号 ${input.versionCode} 已存在`, {
      releaseId: duplicate.id,
    });
  }

  return prisma.release.create({
    data: {
      appId: input.appId,
      versionName: input.versionName,
      versionCode: input.versionCode,
      changelog: input.changelog?.trim() ?? "",
      filePath: input.filePath,
      fileSize: input.fileSize,
      sha256: input.sha256,
      signFingerprint: input.signFingerprint,
      minSdk: input.minSdk,
      forceUpdate: input.forceUpdate ?? false,
      minSupportedVersionCode: input.minSupportedVersionCode ?? null,
      uploadedBy: input.uploadedBy ?? null,
      status: "DRAFT",
      isCurrent: false,
    },
  });
}

/**
 * 覆盖同版本号版本：替换安装包与包信息，可选择立即发布。
 * 保留版本 ID、下载次数与首次发布时间；已归档版本不允许直接发布。
 * @param input 覆盖字段与是否发布
 * @returns 覆盖后的版本记录
 * @throws AppError 版本不存在、已归档却要求发布时抛出
 */
export async function overwriteRelease(input: OverwriteReleaseInput): Promise<Release> {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id: input.releaseId } });
    if (!release) throw new AppError("NOT_FOUND", "版本不存在");
    if (release.status === "ARCHIVED" && input.publish) {
      throw new AppError(
        "VALIDATION_FAILED",
        "该版本已归档，覆盖后不能直接发布，请取消「上传后立即发布」后重试",
      );
    }

    if (input.publish) {
      await tx.release.updateMany({
        where: { appId: release.appId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    const updated = await tx.release.update({
      where: { id: release.id },
      data: {
        versionName: input.versionName,
        filePath: input.filePath,
        fileSize: input.fileSize,
        sha256: input.sha256,
        signFingerprint: input.signFingerprint,
        minSdk: input.minSdk,
        // 未填写更新日志时保留原日志，避免覆盖操作清空说明
        changelog: input.changelog?.trim() ? input.changelog.trim() : release.changelog,
        uploadedBy: input.uploadedBy ?? release.uploadedBy,
        ...(input.publish
          ? {
              status: "PUBLISHED",
              isCurrent: true,
              publishedAt: release.publishedAt ?? new Date(),
            }
          : {}),
      },
    });

    await tx.app.update({ where: { id: release.appId }, data: { updatedAt: new Date() } });
    return updated;
  });
}

/**
 * 发布版本并设为当前版本，同一应用的其他版本自动取消当前标记。
 * @param id 版本 ID
 * @returns 发布后的版本记录
 * @throws AppError 版本不存在或已归档时抛出
 */
export async function publish(id: string): Promise<Release> {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id } });
    if (!release) throw new AppError("NOT_FOUND", "版本不存在");
    if (release.status === "ARCHIVED") {
      throw new AppError("VALIDATION_FAILED", "已归档的版本不能发布");
    }

    await tx.release.updateMany({
      where: { appId: release.appId, isCurrent: true },
      data: { isCurrent: false },
    });

    const published = await tx.release.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        isCurrent: true,
        publishedAt: release.publishedAt ?? new Date(),
      },
    });

    await tx.app.update({ where: { id: release.appId }, data: { updatedAt: new Date() } });
    return published;
  });
}

/**
 * 将某个已发布版本切换为当前版本（用于回滚）。
 * @param id 版本 ID
 * @returns 更新后的版本记录
 * @throws AppError 版本不存在或未发布时抛出
 */
export async function setCurrent(id: string): Promise<Release> {
  return prisma.$transaction(async (tx) => {
    const release = await tx.release.findUnique({ where: { id } });
    if (!release) throw new AppError("NOT_FOUND", "版本不存在");
    if (release.status !== "PUBLISHED") {
      throw new AppError("VALIDATION_FAILED", "仅已发布的版本可以设为当前版本");
    }

    await tx.release.updateMany({
      where: { appId: release.appId, isCurrent: true },
      data: { isCurrent: false },
    });

    const updated = await tx.release.update({ where: { id }, data: { isCurrent: true } });
    await tx.app.update({ where: { id: release.appId }, data: { updatedAt: new Date() } });
    return updated;
  });
}

/**
 * 归档版本，归档后不可再设为当前版本，历史下载链接仍可用。
 * @param id 版本 ID
 * @returns 归档后的版本记录
 * @throws AppError 版本不存在或正在作为当前版本时抛出
 */
export async function archive(id: string): Promise<Release> {
  const release = await prisma.release.findUnique({ where: { id } });
  if (!release) throw new AppError("NOT_FOUND", "版本不存在");
  if (release.isCurrent) {
    throw new AppError("VALIDATION_FAILED", "当前版本不能归档，请先切换到其他版本");
  }

  return prisma.release.update({ where: { id }, data: { status: "ARCHIVED" } });
}

/**
 * 删除版本记录并清理对应 APK 文件。
 * @param id 版本 ID
 * @returns 被删除版本的所属应用 ID
 * @throws AppError 版本不存在或仍是当前版本时抛出
 */
export async function deleteRelease(id: string): Promise<{ appId: string; versionName: string }> {
  const release = await prisma.release.findUnique({ where: { id } });
  if (!release) throw new AppError("NOT_FOUND", "版本不存在");
  if (release.isCurrent) {
    throw new AppError("VALIDATION_FAILED", "当前版本不能删除，请先切换到其他版本");
  }

  await prisma.release.delete({ where: { id } });

  try {
    await removeStoredFile(release.filePath);
  } catch {
    // 文件清理失败不影响数据库删除结果
  }

  return { appId: release.appId, versionName: release.versionName };
}

/**
 * 校验版本号未被占用，用于上传落盘前提前拦截重复版本。
 * @param appId 应用 ID
 * @param versionCode 版本号
 * @returns 无
 * @throws AppError 版本号已存在时抛出 VERSION_CONFLICT
 */
export async function assertVersionAvailable(appId: string, versionCode: number): Promise<void> {
  const existing = await prisma.release.findFirst({ where: { appId, versionCode } });
  if (existing) {
    throw new AppError(
      "VERSION_CONFLICT",
      `版本号 ${versionCode} 已存在，如需替换请勾选「覆盖同版本号」`,
      { releaseId: existing.id },
    );
  }
}

/**
 * 判断某个存储文件是否仍被版本记录引用。
 * @param filePath 以存储根目录为基准的相对路径
 * @returns 被引用返回 true
 */
export async function isReleaseFileReferenced(filePath: string): Promise<boolean> {
  const count = await prisma.release.count({ where: { filePath } });
  return count > 0;
}

/**
 * 按 ID 查询版本（含所属应用）。
 * @param id 版本 ID
 * @returns 版本与应用
 * @throws AppError 不存在时抛出 NOT_FOUND
 */
export async function getReleaseWithApp(id: string): Promise<Release & { app: App }> {
  const release = await prisma.release.findUnique({ where: { id }, include: { app: true } });
  if (!release) throw new AppError("NOT_FOUND", "版本不存在");
  return release;
}

/**
 * 查询某应用的全部版本（含草稿与归档），供管理后台展示与操作。
 * @param appId 应用 ID
 * @returns 版本记录数组（版本号倒序）
 */
export async function listAllReleases(appId: string): Promise<Release[]> {
  return prisma.release.findMany({
    where: { appId },
    orderBy: { versionCode: "desc" },
  });
}

/**
 * 查询某应用已发布的版本列表。
 * @param appId 应用 ID
 * @param limit 返回条数，默认 20
 * @returns 版本记录数组（版本号倒序）
 */
export async function listPublishedReleases(appId: string, limit = 20): Promise<Release[]> {
  return prisma.release.findMany({
    where: { appId, status: "PUBLISHED" },
    orderBy: { versionCode: "desc" },
    take: limit,
  });
}

/**
 * 查询某应用公开可下载的版本（已发布 + 已归档），供详情页历史版本展示。
 * @param appId 应用 ID
 * @param limit 返回条数，默认 20
 * @returns 版本记录数组（版本号倒序）
 */
export async function listDownloadableReleases(appId: string, limit = 20): Promise<Release[]> {
  return prisma.release.findMany({
    where: { appId, status: { in: ["PUBLISHED", "ARCHIVED"] } },
    orderBy: { versionCode: "desc" },
    take: limit,
  });
}

/**
 * 判断某包名是否存在可用更新。
 * 更新基准取 versionCode 最大的已发布版本，与当前展示版本解耦，回滚不会导致客户端降级。
 * @param packageName 应用包名
 * @param currentVersionCode 客户端已安装的版本号
 * @param origin 当前部署的站点根地址
 * @returns 更新检查结果
 */
export async function evaluateUpdate(
  packageName: string,
  currentVersionCode: number,
  origin?: string,
): Promise<UpdateCheckResult> {
  const app = await prisma.app.findFirst({
    where: { packageName, type: "ANDROID", visibility: "PUBLIC" },
  });
  if (!app) {
    return { hasUpdate: false, forceUpdate: false, reason: "NOT_FOUND", latest: null };
  }

  const latest = await prisma.release.findFirst({
    where: { appId: app.id, status: "PUBLISHED" },
    orderBy: { versionCode: "desc" },
  });
  if (!latest || latest.versionCode <= currentVersionCode) {
    return { hasUpdate: false, forceUpdate: false, reason: null, latest: null };
  }

  const forceUpdate =
    latest.forceUpdate ||
    (latest.minSupportedVersionCode !== null && currentVersionCode < latest.minSupportedVersionCode);

  return {
    hasUpdate: true,
    forceUpdate,
    reason: null,
    latest: {
      versionName: latest.versionName,
      versionCode: latest.versionCode,
      changelog: latest.changelog,
      fileSize: latest.fileSize,
      sha256: latest.sha256,
      minSdk: latest.minSdk,
      minSupportedVersionCode: latest.minSupportedVersionCode,
      downloadUrl: signDownloadPath(latest.id, undefined, undefined, origin).url,
      publishedAt: latest.publishedAt?.toISOString() ?? null,
    },
  };
}
