import type { App, Prisma, Release } from "@prisma/client";
import { prisma } from "../db";
import { MAX_RELEASES_IN_DETAIL, type AppType, type Visibility } from "../infra/constants";
import { AppError } from "../infra/errors";
import { logger } from "../infra/logger";
import { getRequestOrigin } from "../http/base-url";
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
  packageName: string | null;
  visibility: Visibility;
  pinned: boolean;
  downloadCount: number;
  updatedAt: string;
  /** 归属开发者，未指派时为 null */
  developer: { id: string; username: string; displayName: string } | null;
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
  releases: {
    id: string;
    versionName: string;
    versionCode: number;
    status: string;
    changelog: string;
    fileSize: number;
    sha256: string;
    minSdk: number | null;
    publishedAt: string | null;
  }[];
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
  developerId?: string | null;
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
 * @param app 应用记录（含当前版本与归属开发者）
 * @returns 卡片 DTO
 */
function toCard(
  app: App & {
    releases: Release[];
    developer?: { id: string; username: string; displayName: string } | null;
  },
): AppCardDto {
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
    packageName: app.packageName,
    visibility: app.visibility as Visibility,
    pinned: app.pinned,
    downloadCount: app.downloadCount,
    updatedAt: app.updatedAt.toISOString(),
    developer: app.developer
      ? {
          id: app.developer.id,
          username: app.developer.username,
          displayName: app.developer.displayName,
        }
      : null,
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
    include: {
      releases: { where: { isCurrent: true }, take: 1 },
      developer: { select: { id: true, username: true, displayName: true } },
    },
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
    include: {
      releases: { where: { isCurrent: true }, take: 1 },
      developer: { select: { id: true, username: true, displayName: true } },
    },
  });
  return apps.map(toCard);
}

/**
 * 查询某开发者名下的应用。
 * @param developerId 开发者 ID
 * @returns 应用卡片数组（更新时间倒序）
 */
export async function listAppsByDeveloper(developerId: string): Promise<AppCardDto[]> {
  const apps = await prisma.app.findMany({
    where: { developerId },
    orderBy: { updatedAt: "desc" },
    include: {
      releases: { where: { isCurrent: true }, take: 1 },
      developer: { select: { id: true, username: true, displayName: true } },
    },
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
        where: { status: { in: ["PUBLISHED", "ARCHIVED"] } },
        orderBy: { versionCode: "desc" },
        take: MAX_RELEASES_IN_DETAIL,
      },
      developer: { select: { id: true, username: true, displayName: true } },
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
          downloadUrl: signDownloadPath(currentRelease.id, undefined, undefined, await getRequestOrigin()).url,
        }
      : null,
    releases: app.releases.map((release) => ({
      id: release.id,
      versionName: release.versionName,
      versionCode: release.versionCode,
      status: release.status,
      changelog: release.changelog,
      fileSize: release.fileSize,
      sha256: release.sha256,
      minSdk: release.minSdk,
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
 * 解析可用的访问标识，被占用时自动追加序号。
 * @param base 期望的访问标识
 * @returns 未被占用的访问标识
 * @throws AppError 连续冲突超过上限时抛出
 */
async function resolveUniqueSlug(base: string): Promise<string> {
  for (let index = 1; index <= 50; index += 1) {
    const candidate = index === 1 ? base : `${base.slice(0, 45)}-${index}`;
    const exists = await prisma.app.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new AppError("VALIDATION_FAILED", "访问标识冲突过多，请手动修改后重试");
}

/**
 * 校验归属开发者是否存在。
 * @param developerId 开发者 ID，空值表示不指派
 * @returns 无
 * @throws AppError 开发者不存在时抛出 VALIDATION_FAILED
 */
async function assertDeveloperExists(developerId: string | null | undefined): Promise<void> {
  if (!developerId) return;
  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    select: { id: true },
  });
  if (!developer) throw new AppError("VALIDATION_FAILED", "归属开发者不存在");
}

/**
 * 创建应用，访问标识重名时自动追加序号。
 * @param input 应用字段
 * @returns 新建的应用记录
 * @throws AppError 字段非法或包名重复时抛出
 */
export async function createApp(input: AppInput): Promise<App> {
  const data = normalizeInput(input);
  await assertDeveloperExists(data.developerId);

  if (data.packageName) {
    const packageOwner = await prisma.app.findFirst({
      where: { packageName: data.packageName },
      select: { id: true },
    });
    if (packageOwner) {
      throw new AppError("VALIDATION_FAILED", "该包名已存在于其他应用");
    }
  }

  const slug = await resolveUniqueSlug(data.slug);

  return prisma.app.create({
    data: {
      slug,
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
      developerId: data.developerId ?? null,
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
    developerId: input.developerId === undefined ? current.developerId : input.developerId,
  });
  await assertDeveloperExists(merged.developerId);

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
      developerId: merged.developerId ?? null,
    },
  });
}

/**
 * 删除应用及其版本记录与磁盘文件。
 * @param id 应用 ID
 * @returns 被删除的应用记录
 */
export async function deleteApp(id: string): Promise<App> {
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

  return app;
}

/**
 * 更新应用图标路径。
 * @param id 应用 ID
 * @param storedPath 图标相对路径
 * @returns 无
 * @throws AppError 应用不存在时抛出 NOT_FOUND
 */
export async function updateAppIcon(id: string, storedPath: string): Promise<void> {
  await getAppById(id);
  await prisma.app.update({ where: { id }, data: { iconPath: storedPath } });
}

/**
 * 追加一张截图到应用。
 * @param id 应用 ID
 * @param storedPath 截图相对路径
 * @returns 更新后的截图路径数组
 * @throws AppError 应用不存在时抛出 NOT_FOUND
 */
export async function appendScreenshot(id: string, storedPath: string): Promise<string[]> {
  const app = await getAppById(id);
  const screenshots = [...parseJsonArray(app.screenshots), storedPath];
  await prisma.app.update({ where: { id }, data: { screenshots: JSON.stringify(screenshots) } });
  return screenshots;
}

/**
 * 按索引删除应用截图。
 * @param id 应用 ID
 * @param index 截图索引（从 0 开始）
 * @returns 被删除的路径与剩余路径数组
 * @throws AppError 应用或截图不存在时抛出 NOT_FOUND
 */
export async function removeScreenshotAt(
  id: string,
  index: number,
): Promise<{ removed: string; remaining: string[] }> {
  const app = await getAppById(id);
  const screenshots = parseJsonArray(app.screenshots);
  if (!Number.isInteger(index) || index < 0 || index >= screenshots.length) {
    throw new AppError("NOT_FOUND", "截图不存在");
  }

  const removed = screenshots[index];
  const remaining = screenshots.filter((_, position) => position !== index);
  await prisma.app.update({ where: { id }, data: { screenshots: JSON.stringify(remaining) } });
  return { removed, remaining };
}

/**
 * 汇总后台已有的分类与标签，用于表单候选项。
 * @returns 去重后的分类与标签数组（按出现次数倒序）
 */
export async function listAdminFacets(): Promise<{ categories: string[]; tags: string[] }> {
  const apps = await prisma.app.findMany({ select: { category: true, tags: true } });
  const categoryCount = new Map<string, number>();
  const tagCount = new Map<string, number>();

  for (const app of apps) {
    categoryCount.set(app.category, (categoryCount.get(app.category) ?? 0) + 1);
    for (const tag of parseJsonArray(app.tags)) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  const sortByCount = (map: Map<string, number>): string[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN")).map(([key]) => key);

  return { categories: sortByCount(categoryCount), tags: sortByCount(tagCount).slice(0, 30) };
}

/** 后台统计概览 */
export interface AdminStats {
  appTotal: number;
  androidCount: number;
  webCount: number;
  publishedCount: number;
  releaseTotal: number;
  totalDownloads: number;
  topApps: { id: string; name: string; slug: string; type: AppType; downloadCount: number }[];
}

/**
 * 统计应用、版本与下载数据，供后台统计页展示。
 * @returns 统计概览
 */
export async function getAdminStats(): Promise<AdminStats> {
  const apps = await prisma.app.findMany({
    orderBy: { downloadCount: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      downloadCount: true,
      releases: { where: { isCurrent: true }, select: { id: true } },
    },
  });
  const releaseTotal = await prisma.release.count();

  return {
    appTotal: apps.length,
    androidCount: apps.filter((app) => app.type === "ANDROID").length,
    webCount: apps.filter((app) => app.type !== "ANDROID").length,
    publishedCount: apps.filter((app) => app.releases.length > 0).length,
    releaseTotal,
    totalDownloads: apps.reduce((sum, app) => sum + app.downloadCount, 0),
    topApps: apps
      .filter((app) => app.downloadCount > 0)
      .slice(0, 10)
      .map((app) => ({
        id: app.id,
        name: app.name,
        slug: app.slug,
        type: app.type as AppType,
        downloadCount: app.downloadCount,
      })),
  };
}
