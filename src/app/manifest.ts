import type { MetadataRoute } from "next";

/**
 * PWA 清单：让站点可添加到主屏并保持独立窗口运行。
 * @returns Web App Manifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "我的应用仓库",
    short_name: "应用仓库",
    description: "个人应用与网页作品的分发展示中心",
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
