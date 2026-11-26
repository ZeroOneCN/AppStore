import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/** 页脚链接分组 */
const GROUPS = [
  {
    title: "产品",
    links: [
      { href: "/", label: "首页" },
      { href: "/apps", label: "应用广场" },
      { href: "/docs", label: "接入文档" },
    ],
  },
  {
    title: "账号",
    links: [
      { href: "/login", label: "统一登录" },
      { href: "/docs#quick-start", label: "快速开始" },
      { href: "/api/openapi", label: "OpenAPI 规范" },
    ],
  },
];

/**
 * 前台页脚：品牌说明与链接分组。
 * @returns 页脚结构
 */
export function SiteFooter() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "应用仓库";

  return (
    <footer className="mt-16 border-t border-black/[0.06] py-10 dark:border-white/10">
      <div className="page-shell grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandLogo size={28} />
            <span className="text-sm font-semibold tracking-tight">{siteName}</span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-6 text-neutral-500 dark:text-neutral-400">
            自建应用分发中心：托管 Android 安装包与网页作品，提供版本管理、签名下载与客户端更新检查能力。
          </p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold tracking-wide text-neutral-900 dark:text-neutral-100">
              {group.title}
            </p>
            <ul className="mt-3 space-y-2 text-xs text-neutral-500 dark:text-neutral-400">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-brand">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="page-shell mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] pt-5 text-[11px] text-neutral-400 dark:border-white/[0.08]">
        <span>© {siteName}</span>
        <span>数据存储在自建服务器上</span>
      </div>
    </footer>
  );
}
