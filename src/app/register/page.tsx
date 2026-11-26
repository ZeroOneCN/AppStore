import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { RegisterForm } from "@/components/register-form";
import { getSession } from "@/server/http/session";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * 注册页数据区：按后台注册模式展示开放注册、邀请码注册或关闭提示。
 * @returns 注册卡片
 */
async function RegisterContent() {
  await connection();

  const session = await getSession();
  if (session) {
    redirect(session.role === "admin" ? "/admin/apps" : "/developer/apps");
  }

  const { siteName, registrationMode } = await getSiteSettings();

  return (
    <div className="relative w-full max-w-[440px]">
      <div className="pointer-events-none absolute -inset-x-16 -top-24 h-64 rounded-full bg-brand/20 blur-[90px]" />

      <div className="relative">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size={64} />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">{siteName}</h1>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            {registrationMode === "INVITE"
              ? "当前为邀请码注册，填写管理员提供的邀请码即可创建开发者账号"
              : "注册开发者账号，创建并管理属于你的应用"}
          </p>
        </div>

        <div className="card-apple p-6 sm:p-8">
          {registrationMode === "OFF" ? (
            <div className="text-center">
              <h2 className="text-base font-semibold tracking-tight">暂未开放注册</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                管理员尚未开放开发者注册，如需账号请联系站点管理员。
              </p>
              <div className="mt-6 space-y-3">
                <Link href="/login" className="btn-primary w-full">
                  去登录
                </Link>
                <Link href="/" className="btn-secondary w-full">
                  返回首页
                </Link>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mb-5 text-center text-base font-semibold tracking-tight">
                {registrationMode === "INVITE" ? "邀请码注册" : "注册开发者账号"}
              </h2>
              <RegisterForm inviteRequired={registrationMode === "INVITE"} />
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-neutral-500">
          <Link href="/" className="transition hover:text-brand">
            ← 返回首页
          </Link>
          {registrationMode !== "OFF" ? (
            <Link href="/login" className="transition hover:text-brand">
              已有账号
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * 注册页骨架。
 * @returns 占位结构
 */
function RegisterSkeleton() {
  return (
    <div className="w-full max-w-[440px] animate-pulse">
      <div className="mx-auto h-16 w-16 rounded-[22%] bg-black/[0.06] dark:bg-white/10" />
      <div className="mx-auto mt-5 h-5 w-40 rounded bg-black/[0.06] dark:bg-white/10" />
      <div className="mt-8 h-96 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
    </div>
  );
}

/**
 * 注册页：玻璃卡片垂直居中。
 * @returns 页面内容
 */
export default function RegisterPage() {
  return (
    <main className="page-center page-shell overflow-hidden py-12 text-neutral-900 dark:text-neutral-50">
      <Suspense fallback={<RegisterSkeleton />}>
        <RegisterContent />
      </Suspense>
    </main>
  );
}
