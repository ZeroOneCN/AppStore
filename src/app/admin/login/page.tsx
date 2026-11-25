import Link from "next/link";
import { LoginForm } from "@/components/admin/login-form";

/**
 * 管理后台登录页。
 * @returns 登录界面
 */
export default function AdminLoginPage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "我的应用仓库";

  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50 px-4 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            A
          </span>
          <div>
            <p className="text-sm font-semibold">{siteName}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">管理后台</p>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h1 className="mb-4 text-lg font-semibold">管理员登录</h1>
          <LoginForm />
          <p className="mt-4 text-center text-xs text-neutral-400">
            连续输错 5 次将锁定 5 分钟
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="transition hover:text-indigo-600 dark:hover:text-indigo-400">
            ← 返回前台
          </Link>
        </p>
      </div>
    </div>
  );
}
