import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { requireAdmin } from "@/server/http/session";

/**
 * 后台外壳：校验管理员会话并渲染毛玻璃导航。
 * @param props.children 页面内容
 * @returns 后台布局
 */
async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();

  let username = "";
  try {
    username = (await requireAdmin()).username;
  } catch {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col text-neutral-900 dark:text-neutral-50">
      <header className="glass-bar sticky top-0 z-20">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link href="/admin/apps" className="flex shrink-0 items-center gap-2">
              <BrandLogo size={28} />
              <span className="text-[15px] font-semibold tracking-tight">管理后台</span>
            </Link>
            <AdminNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="hidden text-neutral-500 sm:inline dark:text-neutral-400">{username}</span>
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 px-2.5 py-1.5 transition hover:bg-white/70 dark:border-white/12 dark:hover:bg-white/10"
            >
              查看前台
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}

/**
 * 后台布局，会话校验期间展示占位。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-neutral-500 dark:text-neutral-400">
          正在校验登录状态…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
