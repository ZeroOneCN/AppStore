import type { Metadata, Viewport } from "next";
import "./globals.css";

/** 站点元数据：社交分享使用 BASE_URL 作为兜底，页面内地址按请求头自动推导 */
const siteUrl = process.env.BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "应用仓库",
    template: "%s · 应用仓库",
  },
  description: "应用分发中心：托管 Android 安装包与网页作品，支持版本管理、签名下载与客户端更新检查。",
  applicationName: "应用仓库",
  appleWebApp: {
    capable: true,
    title: "应用仓库",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

/** 首屏前应用外观偏好，避免深色模式闪白 */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
