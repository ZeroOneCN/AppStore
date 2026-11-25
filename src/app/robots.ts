import type { MetadataRoute } from "next";

/**
 * 站点抓取规则：公开页面可抓取，后台与接口不抓取。
 * @returns robots 配置
 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
