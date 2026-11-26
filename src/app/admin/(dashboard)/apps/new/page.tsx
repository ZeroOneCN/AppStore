import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppForm } from "@/components/admin/app-form";
import { PageHeader } from "@/components/page-header";
import { listAdminFacets } from "@/server/services/app.service";
import { listDevelopers } from "@/server/services/developer.service";
import { requireAdminPage } from "@/server/http/guards";

/**
 * 新建应用表单数据区。
 * @returns 创建表单
 */
async function NewAppContent() {
  await connection();
  await requireAdminPage();
  const [facets, developers] = await Promise.all([listAdminFacets(), listDevelopers()]);

  return (
    <div className="w-full">
      <Link
        href="/admin/apps"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
      >
        ← 返回应用列表
      </Link>
      <PageHeader
        title="新建应用"
        description="先填写基础信息，创建后即可上传 APK、图标与截图"
      />
      <AppForm
        mode="create"
        categories={facets.categories}
        tagOptions={facets.tags}
        developerOptions={developers.map((developer) => ({
          id: developer.id,
          username: developer.username,
          displayName: developer.displayName,
        }))}
      />
    </div>
  );
}

/**
 * 新建应用页。
 * @returns 页面内容
 */
export default function AdminNewAppPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-10 w-48 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-64 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      }
    >
      <NewAppContent />
    </Suspense>
  );
}
