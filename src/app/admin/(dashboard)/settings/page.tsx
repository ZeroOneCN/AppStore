import { PasswordForm } from "@/components/admin/password-form";
import { PageHeader } from "@/components/page-header";

/**
 * 后台设置页：管理员账号安全设置，表单在内容区垂直居中。
 * @returns 页面内容
 */
export default function AdminSettingsPage() {
  return (
    <div className="flex flex-1 items-center justify-center py-6">
      <div className="w-full max-w-xl">
        <PageHeader title="设置" description="管理管理员账号与安全选项" />
        <PasswordForm />
      </div>
    </div>
  );
}
