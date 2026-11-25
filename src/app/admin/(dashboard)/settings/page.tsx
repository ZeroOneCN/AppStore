import { PasswordForm } from "@/components/admin/password-form";

/**
 * 后台设置页：管理员账号安全设置。
 * @returns 页面内容
 */
export default function AdminSettingsPage() {
  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">设置</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          管理管理员账号与安全选项
        </p>
      </div>
      <PasswordForm />
    </div>
  );
}
