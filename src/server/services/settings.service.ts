import { prisma } from "../db";

/** 站点运行配置 */
export interface SiteSettings {
  siteName: string;
  maxApkMb: number;
  baseUrl: string;
}

/** 默认配置：首次启动时用环境变量或内置默认值初始化 */
function defaults(): SiteSettings {
  const maxApk = Number(process.env.MAX_APK_MB);
  return {
    siteName: process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "应用仓库",
    maxApkMb: Number.isInteger(maxApk) && maxApk > 0 ? maxApk : 200,
    baseUrl: (process.env.BASE_URL ?? "").trim(),
  };
}

/**
 * 读取站点配置；首次访问时自动写入默认值（只读单行记录）。
 * @returns 站点配置
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSetting.findUnique({ where: { id: 1 } });
  if (existing) {
    return {
      siteName: existing.siteName,
      maxApkMb: existing.maxApkMb,
      baseUrl: existing.baseUrl,
    };
  }

  const row = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...defaults() },
  });
  return { siteName: row.siteName, maxApkMb: row.maxApkMb, baseUrl: row.baseUrl };
}

/**
 * 更新站点配置。
 * @param input 待更新字段
 * @returns 更新后的配置
 */
export async function updateSiteSettings(input: SiteSettings): Promise<SiteSettings> {
  const row = await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: {
      siteName: input.siteName,
      maxApkMb: input.maxApkMb,
      baseUrl: input.baseUrl,
    },
    create: { id: 1, ...input },
  });
  return { siteName: row.siteName, maxApkMb: row.maxApkMb, baseUrl: row.baseUrl };
}
