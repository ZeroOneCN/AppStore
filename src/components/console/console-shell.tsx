import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ConsoleNav, type ConsoleNavItem } from "@/components/console/console-nav";

/**
 * 后台统一外壳：桌面固定侧边栏、移动端顶部导航。
 * @param props.consoleName 控制台名称
 * @param props.items 导航项
 * @param props.username 当前用户名
 * @param props.roleLabel 角色说明
 * @param props.children 页面内容
 * @returns 后台布局
 */
export function ConsoleShell({
  consoleName,
  items,
  username,
  roleLabel,
  children,
}: {
  consoleName: string;
  items: ConsoleNavItem[];
  username: string;
  roleLabel: string;
  children: React.ReactNode;
}) {
  const initial = username.slice(0, 1).toUpperCase() || "A";

  return (
    <div className="min-h-screen text-neutral-900 dark:text-neutral-50">
      {/* 桌面侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-black/[0.06] bg-white/70 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-[#111113]/80">
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandLogo size={30} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold tracking-tight">应用仓库</p>
            <p className="truncate text-[11px] text-neutral-400">{consoleName}</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <ConsoleNav items={items} />
        </div>

        <div className="border-t border-black/[0.06] p-3 dark:border-white/10">
          <div className="mb-3 flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.05]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand/12 text-[12px] font-semibold text-brand">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{username}</p>
              <p className="truncate text-[11px] text-neutral-400">{roleLabel}</p>
            </div>
          </div>

          <div className="btn-group">
            <Link
              href="/apps"
              target="_blank"
              rel="noreferrer"
              className="btn-secondary min-h-9 px-3 py-2 text-xs"
            >
              浏览应用
            </Link>
            <LogoutButton className="btn-secondary min-h-9 w-full px-3 py-2 text-xs" />
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        {/* 移动端顶部导航 */}
        <header className="glass-bar sticky top-0 z-20 md:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Link href={items[0]?.href ?? "/"} className="flex min-w-0 items-center gap-2">
              <BrandLogo size={26} />
              <span className="truncate text-[14px] font-semibold tracking-tight">{consoleName}</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <ThemeToggle />
              <LogoutButton className="btn-secondary min-h-8 px-2.5 py-1.5 text-xs" />
            </div>
          </div>
          <div className="border-t border-black/[0.05] px-3 py-1.5 dark:border-white/[0.08]">
            <ConsoleNav items={items} orientation="horizontal" />
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 py-7 sm:px-6 md:px-8 md:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}
