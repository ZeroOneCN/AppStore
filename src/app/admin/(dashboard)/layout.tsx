import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { LogoutButton } from "@/components/admin/logout-button";
import { requireAdmin } from "@/server/http/session";

/**
 * 后台外壳：校验管理员会话并渲染导航。
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
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="border-b border-neutral-200/70 bg-white/90 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/90">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/admin/apps" className="shrink-0 text-sm font-semibold">
              管理后台
            </Link>
            <AdminNav />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="hidden text-neutral-500 sm:inline dark:text-neutral-400">{username}</span>
            <Link
              href="/"
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-neutral-200 px-2.5 py-1.5 transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              查看前台
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>
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
        <div className="grid min-h-screen place-items-center bg-neutral-50 text-sm text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400">
          正在校验登录状态…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
