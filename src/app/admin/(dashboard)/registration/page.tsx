import { connection } from "next/server";
import { Suspense } from "react";
import { InviteCodeManager } from "@/components/admin/invite-code-manager";
import { RegistrationModeForm } from "@/components/admin/registration-mode-form";
import { PageHeader } from "@/components/page-header";
import { requireAdminPage } from "@/server/http/guards";
import { countInviteCodes, listInviteCodes } from "@/server/services/invite-code.service";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * 注册管理数据区：注册模式与邀请码。
 * @returns 注册管理内容
 */
async function RegistrationContent() {
  await connection();
  await requireAdminPage("/admin/registration");

  const [{ registrationMode }, items, stats] = await Promise.all([
    getSiteSettings(),
    listInviteCodes(),
    countInviteCodes(),
  ]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="注册管理"
        description="控制开发者自助注册，并管理邀请码；配置保存在数据库后台并优先生效"
      />

      <div className="grid items-start gap-5">
        <RegistrationModeForm mode={registrationMode} />
        <InviteCodeManager items={items} stats={stats} />
      </div>
    </div>
  );
}

/**
 * 注册管理页。
 * @returns 页面内容
 */
export default function AdminRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06]" />
          <div className="h-64 rounded-[22px] bg-black/[0.05]" />
          <div className="h-80 rounded-[22px] bg-black/[0.05]" />
        </div>
      }
    >
      <RegistrationContent />
    </Suspense>
  );
}
