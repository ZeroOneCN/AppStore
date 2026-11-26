import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { AppForm } from "@/components/admin/app-form";
import { IconUploader } from "@/components/admin/icon-uploader";
import { ReleaseManager } from "@/components/admin/release-manager";
import { ScreenshotManager } from "@/components/admin/screenshot-manager";
import type { AdminAppData, AdminReleaseData } from "@/components/admin/types";
import { requireDeveloperPage } from "@/server/http/guards";
import { isAppError } from "@/server/infra/errors";
import { getAppById, parseJsonArray } from "@/server/services/app.service";
import { assertDeveloperApp } from "@/server/services/developer.service";
import { listAllReleases } from "@/server/services/release.service";

/** 动态路由参数 */
type RouteParams = Promise<{ id: string }>;

/**
 * 开发者应用详情数据区：仅允许访问归属自己的应用。
 * @param props.params 路由参数
 * @returns 管理界面
 */
async function DeveloperAppContent({ params }: { params: RouteParams }) {
  await connection();
  const { id } = await params;
  const session = await requireDeveloperPage();

  let record;
  try {
    await assertDeveloperApp(id, session.sub);
    record = await getAppById(id);
  } catch (error) {
    if (isAppError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")) notFound();
    throw error;
  }

  const releases = await listAllReleases(id);

  const app: AdminAppData = {
    id: record.id,
    slug: record.slug,
    name: record.name,
    summary: record.summary,
    description: record.description,
    type: record.type === "WEB" ? "WEB" : "ANDROID",
    category: record.category,
    tags: parseJsonArray(record.tags),
    webUrl: record.webUrl,
    packageName: record.packageName,
    visibility: record.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
    pinned: record.pinned,
    developerId: record.developerId,
    iconUrl: record.iconPath ? `/api/assets/${record.iconPath}` : null,
    screenshots: parseJsonArray(record.screenshots).map((path) => `/api/assets/${path}`),
  };

  const releaseData: AdminReleaseData[] = releases.map((release) => ({
    id: release.id,
    versionName: release.versionName,
    versionCode: release.versionCode,
    changelog: release.changelog,
    fileSize: release.fileSize,
    sha256: release.sha256,
    minSdk: release.minSdk,
    forceUpdate: release.forceUpdate,
    minSupportedVersionCode: release.minSupportedVersionCode,
    status:
      release.status === "PUBLISHED" || release.status === "ARCHIVED" ? release.status : "DRAFT",
    isCurrent: release.isCurrent,
    publishedAt: release.publishedAt?.toISOString() ?? null,
    createdAt: release.createdAt.toISOString(),
  }));

  return (
    <div className="w-full space-y-6">
      <div>
        <Link
          href="/developer/apps"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
        >
          ← 返回我的应用
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <AppIcon name={app.name} iconUrl={app.iconUrl} size={56} />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{app.name}</h1>
              <p className="mt-0.5 text-xs text-neutral-400">/apps/{app.slug}</p>
            </div>
          </div>

          {app.visibility === "PUBLIC" ? (
            <Link
              href={`/apps/${app.slug}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-neutral-200 px-3 py-2 text-sm transition hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            >
              查看前台页面
            </Link>
          ) : null}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">基础信息</h2>
        <AppForm
          mode="edit"
          app={app}
          apiBase="/api/dev/apps"
          afterCreateBase="/developer/apps"
          showAdminFields={false}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">版本管理</h2>
            <ReleaseManager
              appId={app.id}
              appType={app.type}
              releases={releaseData}
              apiBase="/api/dev"
              autoPublish
              showDownload
            />
          </section>

          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">截图管理</h2>
            <ScreenshotManager appId={app.id} screenshots={app.screenshots} apiBase="/api/dev" />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">应用图标</h2>
            <IconUploader appId={app.id} iconUrl={app.iconUrl} apiBase="/api/dev" />
          </section>

          <section className="surface p-5 text-xs text-neutral-500 dark:text-neutral-400">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">记录信息</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-3">
                <dt>应用 ID</dt>
                <dd className="truncate font-mono text-[11px]">{app.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>下载次数</dt>
                <dd>{record.downloadCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>版本数量</dt>
                <dd>{releaseData.length}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

/**
 * 开发者应用详情页。
 * @param props.params 路由参数
 * @returns 页面内容
 */
export default function DeveloperAppDetailPage({ params }: { params: RouteParams }) {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-14 w-64 rounded-xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-72 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      }
    >
      <DeveloperAppContent params={params} />
    </Suspense>
  );
}
