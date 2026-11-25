import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * 前台公共布局：毛玻璃顶部导航与极简页脚。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "我的应用仓库";

  return (
    <div className="flex min-h-screen flex-col text-neutral-900 dark:text-neutral-50">
      <header className="glass-bar sticky top-0 z-20">
        <div className="page-shell flex h-14 items-center justify-between gap-4 sm:h-16">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <BrandLogo size={30} className="transition group-hover:scale-105" />
            <span className="truncate text-[15px] font-semibold tracking-tight">{siteName}</span>
          </Link>

          <nav className="flex shrink-0 items-center gap-1.5 text-sm">
            <Link
              href="/"
              className="rounded-full bg-brand/10 px-3 py-1.5 text-[13px] font-medium text-brand transition hover:bg-brand/15"
            >
              应用墙
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>

      <footer className="border-t border-black/[0.06] py-5 dark:border-white/10">
        <div className="page-shell flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span>个人应用与网页作品的分发展示中心</span>
          <Link
            href="/admin/login"
            className="transition hover:text-brand dark:hover:text-brand-soft"
          >
            管理后台
          </Link>
        </div>
      </footer>
    </div>
  );
}
