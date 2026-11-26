import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppForm } from "@/components/admin/app-form";
import { PageHeader } from "@/components/page-header";
import { requireDeveloperPage } from "@/server/http/guards";
import { listAdminFacets } from "@/server/services/app.service";

/**
 * 开发者新建应用表单数据区，与管理员页面保持一致的布局与字段结构。
 * @returns 开发者创建表单
 */
async function NewDeveloperAppContent() {
  await connection();
  const session = await requireDeveloperPage("/developer/apps/new");
  const facets = await listAdminFacets();

  return (
    <div className="w-full">
      <Link
        href="/developer/apps"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand"
      >
        ← 返回我的应用
      </Link>
      <PageHeader
        title="新建应用"
        description="先填写基础信息，创建后即可上传 APK；可见性、置顶与归属由管理员控制"
      />

      <AppForm
        mode="create"
        apiBase="/api/dev/apps"
        afterCreateBase="/developer/apps"
        categories={facets.categories}
        tagOptions={facets.tags}
        showAdminFields={false}
        developerLabel={session.username}
      />
    </div>
  );
}

/**
 * 开发者新建应用页。
 * @returns 页面内容
 */
export default function NewDeveloperAppPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-black/[0.06]" />
          <div className="h-10 w-48 rounded-xl bg-black/[0.06]" />
          <div className="h-64 rounded-[22px] bg-black/[0.05]" />
        </div>
      }
    >
      <NewDeveloperAppContent />
    </Suspense>
  );
}
