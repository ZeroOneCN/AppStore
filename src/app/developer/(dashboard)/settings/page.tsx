import { connection } from "next/server";
import { Suspense } from "react";
import { PasswordForm } from "@/components/admin/password-form";
import { requireDeveloperPage } from "@/server/http/guards";

/**
 * 开发者账号设置数据区。
 * @returns 改密表单
 */
async function DeveloperSettingsContent() {
  await connection();
  const session = await requireDeveloperPage();

  return (
    <div className="w-full max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">账号设置</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        当前登录：{session.username}
      </p>

      <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">修改密码</h2>
      <PasswordForm
        endpoint="/api/dev/password"
        logoutEndpoint="/api/dev/logout"
        loginPath="/developer/login"
        note="修改成功后当前会话会退出，需使用新密码重新登录开发者门户。"
      />
    </div>
  );
}

/**
 * 开发者账号设置页。
 * @returns 页面内容
 */
export default function DeveloperSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-4xl animate-pulse space-y-4">
          <div className="h-8 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      }
    >
      <DeveloperSettingsContent />
    </Suspense>
  );
}
