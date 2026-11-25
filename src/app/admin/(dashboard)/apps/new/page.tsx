import Link from "next/link";
import { AppForm } from "@/components/admin/app-form";

/**
 * 新建应用页。
 * @returns 创建表单
 */
export default function AdminNewAppPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/admin/apps"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-indigo-600 dark:text-neutral-400 dark:hover:text-indigo-400"
      >
        ← 返回应用列表
      </Link>
      <div className="mb-5 mt-3">
        <h1 className="text-xl font-semibold tracking-tight">新建应用</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          先填写基础信息，创建后即可上传 APK、图标与截图
        </p>
      </div>
      <AppForm mode="create" />
    </div>
  );
}
