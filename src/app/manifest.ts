import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * PWA 清单：让站点可添加到主屏并保持独立窗口运行。
 * @returns Web App Manifest
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { siteName } = await getSiteSettings();
  return {
    name: siteName,
    short_name: siteName,
    description: "应用与网页作品的集中分发中心",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f5f7",
    theme_color: "#1e51ee",
    lang: "zh-CN",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
