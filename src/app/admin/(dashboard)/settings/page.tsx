import { connection } from "next/server";
import { Suspense } from "react";
import { PasswordForm } from "@/components/admin/password-form";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";
import { PageHeader } from "@/components/page-header";
import { requireAdminPage } from "@/server/http/guards";
import { getEnv } from "@/server/infra/env";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * 设置页数据区：站点配置、账号安全与运行环境。
 * @returns 设置内容
 */
async function SettingsContent() {
  await connection();
  const session = await requireAdminPage("/admin/settings");
  const settings = await getSiteSettings();
  const env = getEnv();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title="设置" description="站点运行配置与管理员账号安全" />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <SiteSettingsForm settings={settings} />
        <PasswordForm />
      </div>

      <section className="surface mt-5 p-6">
        <h2 className="text-sm font-semibold">运行环境</h2>
        <p className="mt-1 text-[11px] text-neutral-500">
          敏感配置仍由服务器环境变量管理，不会写入数据库或在前台展示明文
        </p>
        <dl className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          {[
            { label: "当前管理员", value: session.username },
            { label: "数据库", value: env.DATABASE_URL.startsWith("file:") ? "SQLite（本地文件）" : "外部数据库" },
            { label: "文件存储目录", value: env.STORAGE_DIR },
            { label: "会话密钥", value: "已配置（隐藏）" },
            { label: "下载签名密钥", value: "已配置（隐藏）" },
            { label: "站点兜底地址", value: env.BASE_URL },
          ].map((item) => (
            <div key={item.label} className="rounded-xl bg-black/[0.03] px-3.5 py-3">
              <dt className="text-[11px] text-neutral-400">{item.label}</dt>
              <dd className="mt-1 break-all font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

/**
 * 后台设置页。
 * @returns 页面内容
 */
export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06]" />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="h-72 rounded-[22px] bg-black/[0.05]" />
            <div className="h-72 rounded-[22px] bg-black/[0.05]" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
