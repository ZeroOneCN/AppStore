import type { MetadataRoute } from "next";
import { listPublicApps } from "@/server/services/app.service";

/**
 * 站点地图：首页与全部公开应用详情页。
 * @returns 站点地图条目
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
  ];

  try {
    const apps = await listPublicApps({});
    for (const app of apps) {
      entries.push({
        url: `${base}/apps/${app.slug}`,
        lastModified: new Date(app.updatedAt),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    // 构建期数据库不可用时只输出静态首页，不阻断部署
  }

  return entries;
}
