import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/admin/login-form";

/**
 * 管理后台登录页。
 * @returns 登录界面
 */
export default function AdminLoginPage() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME ?? "我的应用仓库";

  return (
    <div className="grid min-h-screen place-items-center px-4 py-12 text-neutral-900 dark:text-neutral-50">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <BrandLogo size={64} />
          <p className="mt-4 text-lg font-semibold tracking-tight">{siteName}</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">管理后台</p>
        </div>

        <div className="card-apple p-6 sm:p-7">
          <h1 className="mb-5 text-center text-base font-semibold tracking-tight">管理员登录</h1>
          <LoginForm />
          <p className="mt-5 text-center text-[11px] text-neutral-400">连续输错 5 次将锁定 5 分钟</p>
        </div>

        <p className="mt-5 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="transition hover:text-brand">
            ← 返回前台
          </Link>
        </p>
      </div>
    </div>
  );
}
