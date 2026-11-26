import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { formatDateTime } from "@/lib/format";
import { requireDeveloperPage } from "@/server/http/guards";
import type { AppCardDto } from "@/server/services/app.service";
import { listDeveloperApps } from "@/server/services/developer.service";

/**
 * 开发者应用卡片。
 * @param props.app 应用卡片数据
 * @returns 指向开发者详情页的卡片
 */
function DeveloperAppCard({ app }: { app: AppCardDto }) {
  return (
    <Link
      href={`/developer/apps/${app.id}`}
      className="group flex flex-col gap-3 rounded-[22px] border border-black/[0.06] bg-white/85 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_18px_40px_-28px_rgba(30,81,238,0.65)] dark:border-white/10 dark:bg-[#1c1c1e]/85 dark:hover:border-brand/40"
    >
      <div className="flex items-start gap-3">
        <AppIcon name={app.name} iconUrl={app.iconUrl} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{app.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
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
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[0.08] dark:text-neutral-300">
          {app.category}
        </span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3 text-[11px] text-neutral-500 dark:border-white/[0.08] dark:text-neutral-400">
        <span className="truncate">
          {app.currentVersion ? `v${app.currentVersion.versionName}` : "尚未发布"}
        </span>
        <span className="shrink-0">{formatDateTime(app.updatedAt)}</span>
      </div>
    </Link>
  );
}

/**
 * 开发者应用列表数据区。
 * @returns 我的应用网格
 */
async function DeveloperAppsContent() {
  await connection();
  const session = await requireDeveloperPage();
  const apps = await listDeveloperApps(session.sub);

  const published = apps.filter((app) => app.currentVersion !== null).length;
  const downloads = apps.reduce((sum, app) => sum + app.downloadCount, 0);

  return (
    <div className="w-full">
      <PageHeader
        title="我的应用"
        description="管理自己的应用与版本，上传 APK 后自动发布为当前版本"
        actions={
          <Link href="/developer/apps/new" className="btn-primary">
            新建应用
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="应用总数" value={apps.length} />
        <StatCard label="已发布" value={published} />
        <StatCard label="累计下载" value={downloads} />
      </div>

      {apps.length === 0 ? (
        <EmptyState
          title="还没有应用"
          description="创建应用并上传第一个 APK，即可开始分发"
          action={
            <Link href="/developer/apps/new" className="btn-primary">
              新建应用
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <DeveloperAppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 开发者应用列表页。
 * @returns 页面内容
 */
export default function DeveloperAppsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-8 w-40 rounded-lg bg-black/[0.06] dark:bg-white/10" />
          <div className="grid grid-cols-3 gap-3">
            <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            <div className="h-20 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
          </div>
        </div>
      }
    >
      <DeveloperAppsContent />
    </Suspense>
  );
}
