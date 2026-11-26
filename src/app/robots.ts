import type { MetadataRoute } from "next";
import { getRequestOrigin } from "@/server/http/base-url";

/**
 * 站点抓取规则：公开页面可抓取，后台与接口不抓取。
 * @returns robots 配置
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getRequestOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/developer", "/login", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
