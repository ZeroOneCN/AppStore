import { prisma } from "../db";
import type { RegistrationMode } from "../infra/constants";

/** 站点运行配置 */
export interface SiteSettings {
  siteName: string;
  maxApkMb: number;
  baseUrl: string;
  registrationMode: RegistrationMode;
}

/** 后台可修改的站点基础配置 */
export type SiteSettingsInput = Pick<SiteSettings, "siteName" | "maxApkMb" | "baseUrl">;

/**
 * 默认配置：首次启动时初始化。
 * 说明：开发者注册模式只认后台数据库设置，默认关闭，不读取环境变量。
 * @returns 默认站点配置
 */
function defaults(): SiteSettings {
  const maxApk = Number(process.env.MAX_APK_MB);
  return {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "应用仓库",
    maxApkMb: Number.isInteger(maxApk) && maxApk > 0 ? maxApk : 200,
    baseUrl: (process.env.BASE_URL ?? "").trim(),
    registrationMode: "OFF",
  };
}

/**
 * 将数据库记录转换为站点配置，注册模式做兜底校验。
 * @param row SiteSetting 记录
 * @returns 站点配置
 */
function toSiteSettings(row: {
  siteName: string;
  maxApkMb: number;
  baseUrl: string;
  registrationMode: string;
}): SiteSettings {
  const mode =
    row.registrationMode === "OPEN" || row.registrationMode === "INVITE"
      ? row.registrationMode
      : "OFF";
  return {
    siteName: row.siteName,
    maxApkMb: row.maxApkMb,
    baseUrl: row.baseUrl,
    registrationMode: mode,
  };
}

/**
 * 读取站点配置；首次访问时自动写入默认值（只读单行记录）。
 * @returns 站点配置
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  if (existing) return toSiteSettings(existing);

  const row = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...defaults() },
  });
  return toSiteSettings(row);
}

/**
 * 更新站点基础配置（名称、上传上限、兜底地址）。
 * @param input 待更新字段
 * @returns 更新后的配置
 */
export async function updateSiteSettings(input: SiteSettingsInput): Promise<SiteSettings> {
  const row = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      siteName: input.siteName,
      maxApkMb: input.maxApkMb,
      baseUrl: input.baseUrl,
    },
    create: { id: 1, ...defaults(), ...input },
  });
  return toSiteSettings(row);
}

/**
 * 更新开发者注册模式，后台设置优先于任何默认值。
 * @param mode 注册模式
 * @returns 更新后的站点配置
 */
export async function updateRegistrationMode(mode: RegistrationMode): Promise<SiteSettings> {
  const row = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: { registrationMode: mode },
    create: { id: 1, ...defaults(), registrationMode: mode },
  });
  return toSiteSettings(row);
}
