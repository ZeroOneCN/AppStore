import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SiteNav } from "@/components/site-nav";
import { getSession } from "@/server/http/session";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * 前台顶部导航：品牌、主导航、外观切换与登录入口。
 * @returns 毛玻璃导航栏
 */
export async function SiteHeader() {
  const session = await getSession();
  const { siteName } = await getSiteSettings();

  const consoleHref = session
    ? session.role === "admin"
      ? "/admin/apps"
      : "/developer/apps"
    : "/login";
  const consoleLabel = session ? "进入控制台" : "登录";

  return (
    <header className="glass-bar sticky top-0 z-30">
      <div className="page-shell">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <div className="flex min-w-0 items-center gap-5">
            <Link href="/" className="group flex min-w-0 items-center gap-2.5">
              <BrandLogo size={30} className="shrink-0 transition group-hover:scale-105" />
              <span className="truncate text-[15px] font-semibold tracking-tight">{siteName}</span>
            </Link>
            <div className="hidden sm:block">
              <SiteNav />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={consoleHref} className="btn-primary px-4 py-2 text-[13px]">
              {consoleLabel}
            </Link>
          </div>
        </div>

        {/* 移动端：导航独占一行，避免品牌、导航与登录按钮挤在一行 */}
        <div className="border-t border-black/[0.05] py-1.5 sm:hidden dark:border-white/[0.08]">
          <SiteNav />
        </div>
      </div>
    </header>
  );
}

/**
 * 导航栏骨架，供会话读取期间占位。
 * @returns 占位结构
 */
export function SiteHeaderSkeleton() {
  return (
    <header className="glass-bar sticky top-0 z-30">
      <div className="page-shell">
        <div className="flex h-14 items-center justify-between gap-3 sm:h-16">
          <div className="flex items-center gap-3">
            <span className="h-[30px] w-[30px] rounded-[22%] bg-black/[0.08] dark:bg-white/10" />
            <span className="h-4 w-24 rounded bg-black/[0.06] dark:bg-white/10" />
          </div>
          <span className="h-8 w-20 rounded-full bg-black/[0.06] dark:bg-white/10" />
        </div>
        <div className="border-t border-black/[0.05] py-2 sm:hidden dark:border-white/[0.08]">
          <span className="block h-7 w-44 rounded-full bg-black/[0.06] dark:bg-white/10" />
        </div>
      </div>
    </header>
  );
}
