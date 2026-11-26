import type { MetadataRoute } from "next";
import { getRequestOrigin } from "@/server/http/base-url";
import { listPublicApps } from "@/server/services/app.service";

/**
 * 站点地图：宣传首页、应用广场、接入文档与全部公开应用详情页。
 * @returns 站点地图条目
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getRequestOrigin();

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/apps`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/docs`, changeFrequency: "weekly", priority: 0.7 },
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
