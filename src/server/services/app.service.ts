import type { App, Prisma, Release } from "@prisma/client";
import { prisma } from "../db";
import { MAX_RELEASES_IN_DETAIL, type AppType, type Visibility } from "../infra/constants";
import { AppError } from "../infra/errors";
import { logger } from "../infra/logger";
import { removeAppFiles } from "./storage.service";
import { signDownloadPath } from "./signing.service";

/** 列表查询参数 */
export interface AppListFilters {
  q?: string;
  category?: string;
  tag?: string;
  type?: AppType;
  sort?: "recent" | "name" | "downloads";
}

/** 应用卡片（列表用） */
export interface AppCardDto {
  id: string;
  slug: string;
  name: string;
  summary: string;
  type: AppType;
  category: string;
  tags: string[];
  iconUrl: string | null;
  pinned: boolean;
  downloadCount: number;
  updatedAt: string;
  currentVersion: { versionName: string; versionCode: number; publishedAt: string } | null;
}

/** 应用详情 */
export interface AppDetailDto extends AppCardDto {
  description: string;
  screenshots: string[];
  webUrl: string | null;
  packageName: string | null;
  currentRelease: {
    id: string;
    versionName: string;
    versionCode: number;
    changelog: string;
    fileSize: number;
    sha256: string;
    minSdk: number | null;
    forceUpdate: boolean;
    minSupportedVersionCode: number | null;
    publishedAt: string | null;
    downloadUrl: string;
  } | null;
  releases: { versionName: string; versionCode: number; publishedAt: string | null }[];
}

/** 创建 / 更新应用的输入 */
export interface AppInput {
  slug: string;
  name: string;
  summary: string;
  description?: string;
  type: AppType;
  category: string;
  tags?: string[];
  webUrl?: string | null;
  packageName?: string | null;
  visibility?: Visibility;
  pinned?: boolean;
}

/** slug 只允许小写字母、数字与连字符 */
const SLUG_PATTERN = /^[a-z0-9-]{2,48}$/;

/**
 * 解析 JSON 数组字段，异常时返回空数组。
 * @param value 数据库中的 JSON 字符串
 * @returns 字符串数组
 */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 将存储相对路径转换为可访问的资源地址。
 * @param storedPath 相对路径，如 icons/xxx.png
 * @returns 站内资源 URL，空路径返回 null
 */
function assetUrl(storedPath: string | null | undefined): string | null {
  return storedPath ? `/api/assets/${storedPath}` : null;
}

/**
 * 校验并规范化应用输入。
 * @param input 原始输入
 * @returns 规范化后的字段
 * @throws AppError 字段不合法时抛出 VALIDATION_FAILED
 */
function normalizeInput(input: AppInput): AppInput {
  const slug = input.slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new AppError("VALIDATION_FAILED", "slug 仅允许 2-48 位小写字母、数字或连字符");
  }
  if (!input.name.trim()) throw new AppError("VALIDATION_FAILED", "应用名称不能为空");
  if (!input.summary.trim()) throw new AppError("VALIDATION_FAILED", "一句话简介不能为空");
  if (!input.category.trim()) throw new AppError("VALIDATION_FAILED", "分类不能为空");

  let packageName = input.packageName?.trim() || null;
  let webUrl = input.webUrl?.trim() || null;

  if (input.type === "ANDROID") {
    if (!packageName) throw new AppError("VALIDATION_FAILED", "Android 应用必须填写包名");
    webUrl = null;
  } else {
    if (!webUrl) throw new AppError("VALIDATION_FAILED", "网页作品必须填写访问链接");
    try {
      new URL(webUrl);
    } catch {
      throw new AppError("VALIDATION_FAILED", "网页作品链接不是合法的 URL");
    }
    packageName = null;
  }

  return {
    ...input,
    slug,
    name: input.name.trim(),
    summary: input.summary.trim(),
    description: input.description?.trim() ?? "",
    category: input.category.trim(),
    tags: input.tags ?? [],
    packageName,
    webUrl,
  };
}

/**
 * 将数据库记录转换为列表卡片。
 * @param app 应用记录（含当前版本）
 * @returns 卡片 DTO
 */
function toCard(app: App & { releases: Release[] }): AppCardDto {
  const current = app.releases[0];
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    summary: app.summary,
    type: app.type as AppType,
    category: app.category,
    tags: parseJsonArray(app.tags),
    iconUrl: assetUrl(app.iconPath),
    pinned: app.pinned,
    downloadCount: app.downloadCount,
    updatedAt: app.updatedAt.toISOString(),
    currentVersion: current
      ? {
          versionName: current.versionName,
          versionCode: current.versionCode,
          publishedAt: (current.publishedAt ?? current.createdAt).toISOString(),
        }
      : null,
  };
}

/**
 * 查询公开应用列表。
 * @param filters 关键词、分类、标签、类型与排序
 * @returns 应用卡片数组，置顶优先
 */
export async function listPublicApps(filters: AppListFilters): Promise<AppCardDto[]> {
  const where: Prisma.AppWhereInput = { visibility: "PUBLIC" };
  if (filters.type) where.type = filters.type;
  if (filters.category) where.category = filters.category;
  if (filters.q) {
    where.OR = [{ name: { contains: filters.q } }, { summary: { contains: filters.q } }];
  }
  // tags 以 JSON 字符串存储，SQLite 无法结构化查询，这里按完整带引号标签匹配
  if (filters.tag) where.tags = { contains: `"${filters.tag}"` };

  const sort = filters.sort ?? "recent";
  const orderBy: Prisma.AppOrderByWithRelationInput[] =
    sort === "name"
      ? [{ pinned: "desc" }, { name: "asc" }]
      : sort === "downloads"
        ? [{ pinned: "desc" }, { downloadCount: "desc" }]
        : [{ pinned: "desc" }, { updatedAt: "desc" }];

  const apps = await prisma.app.findMany({
    where,
    orderBy,
    include: { releases: { where: { isCurrent: true }, take: 1 } },
  });

  return apps.map(toCard);
}

/**
 * 查询后台全部应用（含草稿与私有）。
 * @returns 应用卡片数组
 */
export async function listAdminApps(): Promise<AppCardDto[]> {
  const apps = await prisma.app.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    include: { releases: { where: { isCurrent: true }, take: 1 } },
  });
  return apps.map(toCard);
}

/**
 * 按 slug 查询应用详情。
 * @param slug 应用短标识
 * @param includePrivate 是否包含私有应用（仅后台使用）
 * @returns 详情 DTO
 * @throws AppError 不存在或不可见时抛出 NOT_FOUND
 */
export async function getAppBySlug(slug: string, includePrivate = false): Promise<AppDetailDto> {
  const app = await prisma.app.findUnique({
    where: { slug },
    include: {
      releases: {
        where: { status: "PUBLISHED" },
        orderBy: { versionCode: "desc" },
        take: MAX_RELEASES_IN_DETAIL,
      },
    },
  });

  if (!app || (!includePrivate && app.visibility !== "PUBLIC")) {
    throw new AppError("NOT_FOUND", "应用不存在或未公开");
  }

  const currentRelease = await prisma.release.findFirst({ where: { appId: app.id, isCurrent: true } });
  const card = toCard({ ...app, releases: currentRelease ? [currentRelease] : [] });

  return {
    ...card,
    description: app.description,
    screenshots: parseJsonArray(app.screenshots).map((path) => assetUrl(path) as string),
    webUrl: app.webUrl,
    packageName: app.packageName,
    currentRelease: currentRelease
      ? {
          id: currentRelease.id,
          versionName: currentRelease.versionName,
          versionCode: currentRelease.versionCode,
          changelog: currentRelease.changelog,
          fileSize: currentRelease.fileSize,
          sha256: currentRelease.sha256,
          minSdk: currentRelease.minSdk,
          forceUpdate: currentRelease.forceUpdate,
          minSupportedVersionCode: currentRelease.minSupportedVersionCode,
          publishedAt: currentRelease.publishedAt?.toISOString() ?? null,
          downloadUrl: signDownloadPath(currentRelease.id).url,
        }
      : null,
    releases: app.releases.map((release) => ({
      versionName: release.versionName,
      versionCode: release.versionCode,
      publishedAt: release.publishedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * 按 ID 查询应用原始记录。
 * @param id 应用 ID
 * @returns 应用记录
 * @throws AppError 不存在时抛出 NOT_FOUND
 */
export async function getAppById(id: string): Promise<App> {
  const app = await prisma.app.findUnique({ where: { id } });
  if (!app) throw new AppError("NOT_FOUND", "应用不存在");
  return app;
}

/**
 * 创建应用。
 * @param input 应用字段
 * @returns 新建的应用记录
 * @throws AppError 字段非法或 slug/包名重复时抛出
 */
export async function createApp(input: AppInput): Promise<App> {
  const data = normalizeInput(input);

  const existing = await prisma.app.findFirst({
    where: { OR: [{ slug: data.slug }, ...(data.packageName ? [{ packageName: data.packageName }] : [])] },
  });
  if (existing) {
    throw new AppError(
      "VALIDATION_FAILED",
      existing.slug === data.slug ? "slug 已被占用" : "该包名已存在于其他应用",
    );
  }

  return prisma.app.create({
    data: {
      slug: data.slug,
      name: data.name,
      summary: data.summary,
      description: data.description ?? "",
      type: data.type,
      category: data.category,
      tags: JSON.stringify(data.tags ?? []),
      webUrl: data.webUrl,
      packageName: data.packageName,
      visibility: data.visibility ?? "PUBLIC",
      pinned: data.pinned ?? false,
    },
  });
}

/**
 * 更新应用基础信息。
 * @param id 应用 ID
 * @param input 部分字段
 * @returns 更新后的应用记录
 * @throws AppError 应用不存在或字段非法时抛出
 */
export async function updateApp(id: string, input: Partial<AppInput>): Promise<App> {
  const current = await getAppById(id);
  const merged = normalizeInput({
    slug: input.slug ?? current.slug,
    name: input.name ?? current.name,
    summary: input.summary ?? current.summary,
    description: input.description ?? current.description,
    type: (input.type ?? current.type) as AppType,
    category: input.category ?? current.category,
    tags: input.tags ?? parseJsonArray(current.tags),
    webUrl: input.webUrl === undefined ? current.webUrl : input.webUrl,
    packageName: input.packageName === undefined ? current.packageName : input.packageName,
    visibility: (input.visibility ?? current.visibility) as Visibility,
    pinned: input.pinned ?? current.pinned,
  });

  const conflict = await prisma.app.findFirst({
    where: {
      id: { not: id },
      OR: [{ slug: merged.slug }, ...(merged.packageName ? [{ packageName: merged.packageName }] : [])],
    },
  });
  if (conflict) {
    throw new AppError(
      "VALIDATION_FAILED",
      conflict.slug === merged.slug ? "slug 已被占用" : "该包名已存在于其他应用",
    );
  }

  return prisma.app.update({
    where: { id },
    data: {
      slug: merged.slug,
      name: merged.name,
      summary: merged.summary,
      description: merged.description ?? "",
      type: merged.type,
      category: merged.category,
      tags: JSON.stringify(merged.tags ?? []),
      webUrl: merged.webUrl,
      packageName: merged.packageName,
      visibility: merged.visibility ?? "PUBLIC",
      pinned: merged.pinned ?? false,
    },
  });
}

/**
 * 删除应用及其版本记录与磁盘文件。
 * @param id 应用 ID
 * @returns 无
 */
export async function deleteApp(id: string): Promise<void> {
  const app = await getAppById(id);
  await prisma.app.delete({ where: { id } });

  try {
    await removeAppFiles(app.id);
  } catch (error) {
    // 数据库已删除，磁盘清理失败只记录日志，避免阻塞删除流程
    logger.warn("应用磁盘文件清理失败", {
      appId: app.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
