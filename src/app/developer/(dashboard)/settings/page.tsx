import { connection } from "next/server";
import { Suspense } from "react";
import { PasswordForm } from "@/components/admin/password-form";
import { PageHeader } from "@/components/page-header";
import { requireDeveloperPage } from "@/server/http/guards";

/**
 * 开发者账号设置数据区。
 * @returns 改密表单
 */
async function DeveloperSettingsContent() {
  await connection();
  const session = await requireDeveloperPage();

  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div className="w-full max-w-xl">
        <PageHeader title="账号设置" description={`当前登录：${session.username}`} />
        <PasswordForm note="修改成功后当前会话会退出，需使用新密码重新登录开发者门户。" />
      </div>
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
        <div className="w-full max-w-xl animate-pulse space-y-4">
          <div className="h-8 w-40 rounded bg-black/[0.06] dark:bg-white/10" />
          <div className="h-64 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      }
    >
      <DeveloperSettingsContent />
    </Suspense>
  );
}
