import Link from "next/link";

/**
 * 前台公共布局：顶部导航与页脚。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "我的应用仓库";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-white/85 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/85">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              A
            </span>
            <span className="truncate text-sm font-semibold sm:text-base">{siteName}</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-4 text-sm">
            <Link
              href="/"
              className="rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white"
            >
              应用墙
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-neutral-200/70 py-6 dark:border-neutral-800/80">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-neutral-500 sm:px-6 dark:text-neutral-400">
          <span>个人应用与网页作品的分发展示中心</span>
          <Link href="/admin/login" className="transition hover:text-neutral-900 dark:hover:text-white">
            管理后台
          </Link>
        </div>
      </footer>
    </div>
  );
}
