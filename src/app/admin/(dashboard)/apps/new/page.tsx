import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppForm } from "@/components/admin/app-form";
import { listAdminFacets } from "@/server/services/app.service";

/**
 * 新建应用表单数据区。
 * @returns 创建表单
 */
async function NewAppContent() {
  await connection();
  const facets = await listAdminFacets();

  return (
    <div className="w-full">
      <Link
        href="/admin/apps"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
      >
        ← 返回应用列表
      </Link>
      <div className="mb-5 mt-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">新建应用</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          先填写基础信息，创建后即可上传 APK、图标与截图
        </p>
      </div>
      <AppForm mode="create" categories={facets.categories} tagOptions={facets.tags} />
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
