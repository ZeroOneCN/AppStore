import type { App, Developer, Release } from "@prisma/client";
import { prisma } from "../db";
import { DEVELOPER_STATUSES, type DeveloperStatus } from "../infra/constants";
import { AppError } from "../infra/errors";
import { hashPassword, verifyPassword } from "./auth.service";
import {
  createApp,
  listAppsByDeveloper,
  updateApp,
  type AppCardDto,
  type AppInput,
} from "./app.service";

/** 开发者用户名规则 */
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;

/** 开发者列表条目 */
export interface DeveloperListItem {
  id: string;
  username: string;
  displayName: string;
  status: DeveloperStatus;
  appCount: number;
  createdAt: string;
}

/** 创建开发者输入 */
export interface CreateDeveloperInput {
  username: string;
  displayName?: string;
  password: string;
}

/**
 * 校验开发者密码强度。
 * @param password 明文密码
 * @returns 无
 * @throws AppError 长度不足时抛出 VALIDATION_FAILED
 */
function assertPassword(password: string): void {
  if (password.length < 8) throw new AppError("VALIDATION_FAILED", "密码至少 8 位");
  if (password.length > 64) throw new AppError("VALIDATION_FAILED", "密码不能超过 64 位");
}

/**
 * 查询开发者列表，附带应用数量。
 * @returns 开发者列表（创建时间倒序）
 */
export async function listDevelopers(): Promise<DeveloperListItem[]> {
  const rows = await prisma.developer.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { apps: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    status: row.status === "DISABLED" ? "DISABLED" : "ACTIVE",
    appCount: row._count.apps,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * 创建开发者账号。
 * @param input 用户名、显示名与初始密码
 * @returns 新建的开发者记录
 * @throws AppError 用户名不合法、重复或密码过弱时抛出
 */
export async function createDeveloper(input: CreateDeveloperInput): Promise<Developer> {
  const username = input.username.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new AppError("VALIDATION_FAILED", "用户名仅允许 3-32 位字母、数字、下划线或连字符");
  }
  assertPassword(input.password);

  const exists = await prisma.developer.findUnique({ where: { username }, select: { id: true } });
  if (exists) throw new AppError("VALIDATION_FAILED", "该用户名已被其他开发者使用");

  return prisma.developer.create({
    data: {
      username,
      displayName: input.displayName?.trim() ?? "",
      passwordHash: await hashPassword(input.password),
      status: "ACTIVE",
    },
  });
}

/**
 * 按 ID 查询开发者。
 * @param id 开发者 ID
 * @returns 开发者记录
 * @throws AppError 不存在时抛出 NOT_FOUND
 */
export async function getDeveloperById(id: string): Promise<Developer> {
  const developer = await prisma.developer.findUnique({ where: { id } });
  if (!developer) throw new AppError("NOT_FOUND", "开发者不存在");
  return developer;
}

/**
 * 启用或停用开发者账号。
 * @param id 开发者 ID
 * @param status 目标状态
 * @returns 更新后的开发者记录
 * @throws AppError 状态非法或开发者不存在时抛出
 */
export async function setDeveloperStatus(id: string, status: string): Promise<Developer> {
  if (!(DEVELOPER_STATUSES as readonly string[]).includes(status)) {
    throw new AppError("VALIDATION_FAILED", "状态仅支持 ACTIVE 或 DISABLED");
  }
  await getDeveloperById(id);
  return prisma.developer.update({ where: { id }, data: { status } });
}

/**
 * 管理员重置开发者密码（无需当前密码）。
 * @param id 开发者 ID
 * @param newPassword 新明文密码
 * @returns 无
 * @throws AppError 开发者不存在或密码过弱时抛出
 */
export async function resetDeveloperPassword(id: string, newPassword: string): Promise<void> {
  assertPassword(newPassword);
  await getDeveloperById(id);
  await prisma.developer.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

/**
 * 开发者自行修改密码：校验当前密码后写入新哈希。
 * @param id 开发者 ID
 * @param currentPassword 当前明文密码
 * @param newPassword 新明文密码
 * @returns 无
 * @throws AppError 密码不合规、账号不存在或当前密码错误时抛出
 */
export async function changeDeveloperPassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  assertPassword(newPassword);
  if (newPassword === currentPassword) {
    throw new AppError("VALIDATION_FAILED", "新密码不能与当前密码相同");
  }

  const developer = await getDeveloperById(id);
  if (!(await verifyPassword(currentPassword, developer.passwordHash))) {
    throw new AppError("UNAUTHORIZED", "当前密码不正确");
  }

  await prisma.developer.update({
    where: { id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
}

/**
 * 校验应用归属：应用必须归属该开发者。
 * @param appId 应用 ID
 * @param developerId 开发者 ID
 * @returns 应用记录
 * @throws AppError 应用不存在或不属于该开发者时抛出
 */
export async function assertDeveloperApp(appId: string, developerId: string): Promise<App> {
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app || app.developerId !== developerId) {
    throw new AppError("FORBIDDEN", "无权访问该应用");
  }
  return app;
}

/**
 * 校验版本归属：版本所属应用必须归属该开发者。
 * @param releaseId 版本 ID
 * @param developerId 开发者 ID
 * @returns 版本记录
 * @throws AppError 版本不存在或不属于该开发者时抛出
 */
export async function assertDeveloperRelease(
  releaseId: string,
  developerId: string,
): Promise<Release> {
  const release = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!release) throw new AppError("NOT_FOUND", "版本不存在");

  const app = await prisma.app.findUnique({
    where: { id: release.appId },
    select: { developerId: true },
  });
  if (!app || app.developerId !== developerId) {
    throw new AppError("FORBIDDEN", "无权操作该版本");
  }
  return release;
}

/**
 * 查询某开发者的应用列表。
 * @param developerId 开发者 ID
 * @returns 应用卡片数组（更新时间倒序）
 */
export async function listDeveloperApps(developerId: string): Promise<AppCardDto[]> {
  return listAppsByDeveloper(developerId);
}

/**
 * 开发者创建应用，强制写入归属开发者，可见性由开发者选择。
 * @param developerId 开发者 ID
 * @param input 应用字段（不含归属与置顶）
 * @returns 新建的应用记录
 */
export async function createDeveloperApp(
  developerId: string,
  input: Omit<AppInput, "developerId" | "pinned">,
): Promise<App> {
  return createApp({
    ...input,
    developerId,
    visibility: input.visibility ?? "PUBLIC",
    pinned: false,
  });
}

/**
 * 开发者更新自己的应用，仅允许基础资料字段。
 * @param developerId 开发者 ID
 * @param appId 应用 ID
 * @param input 可更新字段
 * @returns 更新后的应用记录
 * @throws AppError 应用不属于该开发者时抛出 FORBIDDEN
 */
export async function updateDeveloperApp(
  developerId: string,
  appId: string,
  input: Partial<Omit<AppInput, "developerId" | "pinned">>,
): Promise<App> {
  await assertDeveloperApp(appId, developerId);
  return updateApp(appId, input);
}
