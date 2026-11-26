import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppForm } from "@/components/admin/app-form";
import { PageHeader } from "@/components/page-header";

/**
 * 新建应用表单数据区。
 * @returns 开发者创建表单
 */
async function NewDeveloperAppContent() {
  await connection();

  return (
    <div className="w-full max-w-4xl">
      <Link
        href="/developer/apps"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
      >
        ← 返回我的应用
      </Link>
      <PageHeader
        title="新建应用"
        description="创建后可上传 APK，解析成功会直接发布；可见性与置顶由管理员控制"
      />

      <AppForm
        mode="create"
        apiBase="/api/dev/apps"
        afterCreateBase="/developer/apps"
        showAdminFields={false}
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
        <div className="w-full max-w-4xl animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-8 w-40 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-96 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      }
    >
      <NewDeveloperAppContent />
    </Suspense>
  );
}
