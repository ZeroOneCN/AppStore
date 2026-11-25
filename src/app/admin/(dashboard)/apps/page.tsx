import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { formatDateTime } from "@/lib/format";
import { listAdminApps } from "@/server/services/app.service";

/**
 * 后台应用列表数据区。
 * @returns 应用卡片网格
 */
async function AppsContent() {
  await connection();
  const apps = await listAdminApps();

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">应用管理</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            共 {apps.length} 个应用，包含草稿与私有应用
          </p>
        </div>
        <Link
          href="/admin/apps/new"
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          新建应用
        </Link>
      </div>

      {apps.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
          <p className="text-base font-medium">还没有应用</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            先创建应用，再上传 APK 或填写网页链接
          </p>
          <Link
            href="/admin/apps/new"
            className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            新建应用
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/admin/apps/${app.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500/60"
            >
              <div className="flex items-start gap-3">
                <AppIcon name={app.name} iconUrl={app.iconUrl} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{app.name}</h2>
                    {app.pinned ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                        置顶
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">/{app.slug}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500 dark:text-neutral-400">
                    {app.summary}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    app.type === "ANDROID"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                  }`}
                >
                  {app.type === "ANDROID" ? "Android" : "网页"}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {app.category}
                </span>
                {app.visibility === "PRIVATE" ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                    私有
                  </span>
                ) : null}
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
                <span className="truncate">
                  {app.currentVersion ? `当前 v${app.currentVersion.versionName}` : "尚未发布"}
                </span>
                <span className="shrink-0">{formatDateTime(app.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * 后台应用列表页。
 * @returns 页面内容
 */
export default function AdminAppsPage() {
  return (
    <Suspense
      fallback={
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      }
    >
      <AppsContent />
    </Suspense>
  );
}
