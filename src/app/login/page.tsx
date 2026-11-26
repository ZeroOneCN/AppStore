import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/admin/login-form";
import { getSession } from "@/server/http/session";
import { getSiteSettings } from "@/server/services/settings.service";

/** 登录页查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 读取登录后跳转目标，仅接受站内路径。
 * @param params 查询参数
 * @returns 站内路径或 null
 */
function readNext(params: Record<string, string | string[] | undefined>): string | null {
  const value = params.next;
  const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next.slice(0, 200);
}

/**
 * 统一登录数据区：已登录用户直接跳转到对应控制台。
 * @param props.searchParams 查询参数，支持 next 回跳
 * @returns 登录卡片
 */
async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();

  const session = await getSession();
  if (session) {
    redirect(session.role === "admin" ? "/admin/apps" : "/developer/apps");
  }

  const next = readNext(await searchParams);
  const { siteName, registrationMode } = await getSiteSettings();

  return (
    <div className="relative w-full max-w-[420px]">
      <div className="pointer-events-none absolute -inset-x-16 -top-24 h-64 rounded-full bg-brand/20 blur-[90px]" />

      <div className="relative">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo size={64} />
          <h1 className="mt-5 text-xl font-semibold tracking-tight">{siteName}</h1>
          <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            管理员与开发者使用同一入口，登录后自动进入对应控制台
          </p>
        </div>

        <div className="card-apple p-6 sm:p-8">
          <h2 className="mb-5 text-center text-base font-semibold tracking-tight">登录账号</h2>
          <LoginForm next={next} />
          {registrationMode !== "OFF" ? (
            <p className="mt-5 border-t border-black/[0.06] pt-4 text-center text-xs text-neutral-500 dark:border-white/10 dark:text-neutral-400">
              还没有开发者账号？
              <Link
                href="/register"
                className="ml-1 font-medium text-brand transition hover:text-brand-deep"
              >
                {registrationMode === "INVITE" ? "使用邀请码注册" : "立即注册"}
              </Link>
            </p>
          ) : null}
          <p className="mt-5 text-center text-[11px] leading-5 text-neutral-400">
            连续输错 5 次将锁定 5 分钟
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center text-xs text-neutral-500">
          <Link href="/" className="transition hover:text-brand">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * 登录页骨架。
 * @returns 占位结构
 */
function LoginSkeleton() {
  return (
    <div className="w-full max-w-[420px] animate-pulse">
      <div className="mx-auto h-16 w-16 rounded-[22%] bg-black/[0.06] dark:bg-white/10" />
      <div className="mx-auto mt-5 h-5 w-40 rounded bg-black/[0.06] dark:bg-white/10" />
      <div className="mt-8 h-72 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
    </div>
  );
}

/**
 * 登录页：玻璃卡片垂直居中。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="page-center page-shell overflow-hidden py-12 text-neutral-900 dark:text-neutral-50">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
