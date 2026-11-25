import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { formatDateTime } from "@/lib/format";
import { listAdminApps } from "@/server/services/app.service";

/**
 * 概览统计卡片。
 * @param props.label 指标名称
 * @param props.value 指标数值
 * @param props.hint 补充说明
 * @returns 统计卡片
 */
function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card-apple px-4 py-3.5">
      <dt className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
      <p className="mt-0.5 text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}

/**
 * 后台应用列表数据区。
 * @returns 概览统计与应用卡片网格
 */
async function AppsContent() {
  await connection();
  const apps = await listAdminApps();

  const published = apps.filter((app) => app.currentVersion).length;
  const androidCount = apps.filter((app) => app.type === "ANDROID").length;
  const webCount = apps.length - androidCount;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">应用管理</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            统一管理应用信息、版本发布与安装包
          </p>
        </div>
        <Link href="/admin/apps/new" className="btn-primary">
          新建应用
        </Link>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="应用总数" value={apps.length} hint="包含草稿与私有应用" />
        <StatCard label="已发布" value={published} hint="至少有一个正式版本" />
        <StatCard label="Android" value={androidCount} hint="通过 APK 分发" />
        <StatCard label="网页作品" value={webCount} hint="跳转外部链接" />
      </dl>

      {apps.length === 0 ? (
        <div className="card-apple grid min-h-[420px] place-items-center px-6 text-center">
          <p className="text-base font-medium">还没有应用</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            先创建应用，再上传 APK 或填写网页链接
          </p>
          <Link
            href="/admin/apps/new"
            className="btn-primary mt-5"
          >
            新建应用
          </Link>
        </div>
      ) : (
        <div className="grid auto-rows-fr gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
          {apps.map((app) => (
            <Link
              key={app.id}
              href={`/admin/apps/${app.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white/85 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_18px_40px_-28px_rgba(30,81,238,0.65)] dark:border-white/10 dark:bg-[#1c1c1e]/85"
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
        <div className="animate-pulse">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-2">
              <div className="h-8 w-40 rounded-lg bg-black/[0.06] dark:bg-white/10" />
              <div className="h-4 w-64 max-w-full rounded bg-black/[0.05] dark:bg-white/[0.07]" />
            </div>
            <div className="h-10 w-24 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[92px] rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            ))}
          </div>
        </div>
      }
    >
      <AppsContent />
    </Suspense>
  );
}
