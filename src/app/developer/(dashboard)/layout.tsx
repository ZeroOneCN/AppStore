import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/admin/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DevNav } from "@/components/developer/dev-nav";
import { requireDeveloper } from "@/server/http/session";

/**
 * 开发者门户外壳：校验开发者会话并渲染导航。
 * @param props.children 页面内容
 * @returns 门户布局
 */
async function DeveloperShell({ children }: { children: React.ReactNode }) {
  await connection();

  let username = "";
  try {
    username = (await requireDeveloper()).username;
  } catch {
    redirect("/developer/login");
  }

  return (
    <div className="flex min-h-screen flex-col text-neutral-900 dark:text-neutral-50">
      <header className="glass-bar sticky top-0 z-20">
        <div className="page-shell flex h-14 items-center justify-between gap-3 sm:h-16">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/developer/apps" className="flex shrink-0 items-center gap-2">
              <BrandLogo size={28} />
              <span className="text-[15px] font-semibold tracking-tight">开发者门户</span>
            </Link>
            <DevNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="hidden text-neutral-500 sm:inline dark:text-neutral-400">{username}</span>
            <ThemeToggle />
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 px-2.5 py-1.5 transition hover:bg-white/70 dark:border-white/12 dark:hover:bg-white/10"
            >
              查看前台
            </Link>
            <LogoutButton endpoint="/api/dev/logout" redirectTo="/developer/login" />
          </div>
        </div>
      </header>
      <main className="page-shell flex flex-1 flex-col py-8 sm:py-10">{children}</main>
    </div>
  );
}

/**
 * 开发者门户布局，会话校验期间展示占位。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-neutral-500 dark:text-neutral-400">
          正在校验登录状态…
        </div>
      }
    >
      <DeveloperShell>{children}</DeveloperShell>
    </Suspense>
  );
}
