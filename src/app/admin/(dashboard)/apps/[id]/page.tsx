import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { AppForm } from "@/components/admin/app-form";
import { DeleteAppButton } from "@/components/admin/delete-app-button";
import { IconUploader } from "@/components/admin/icon-uploader";
import { ReleaseManager } from "@/components/admin/release-manager";
import { ScreenshotManager } from "@/components/admin/screenshot-manager";
import type { AdminAppData, AdminReleaseData } from "@/components/admin/types";
import { formatDateTime } from "@/lib/format";
import { isAppError } from "@/server/infra/errors";
import { getAppById, listAdminFacets, parseJsonArray } from "@/server/services/app.service";
import { listAllReleases } from "@/server/services/release.service";
import { listDevelopers } from "@/server/services/developer.service";
import { requireAdminPage } from "@/server/http/guards";

/** 动态路由参数 */
type RouteParams = Promise<{ id: string }>;

/** 查询参数：created=1 表示刚由新建页一步创建完成 */
type RouteSearchParams = Promise<{ created?: string; version?: string }>;

/**
 * 应用详情数据区：组装后台所需数据并渲染各管理模块。
 * @param props.params 路由参数
 * @param props.searchParams 查询参数，用于展示创建成功提示
 * @returns 管理界面
 */
async function AdminAppContent({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearchParams;
}) {
  await connection();
  await requireAdminPage();
  const { id } = await params;
  const { created, version } = await searchParams;

  let record;
  try {
    record = await getAppById(id);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const [releases, facets, developers] = await Promise.all([
    listAllReleases(id),
    listAdminFacets(),
    listDevelopers(),
  ]);

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
          href="/admin/apps"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
        >
          ← 返回应用列表
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <AppIcon name={app.name} iconUrl={app.iconUrl} size={56} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{app.name}</h1>
                {app.pinned ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    置顶
                  </span>
                ) : null}
                {app.visibility === "PRIVATE" ? (
                  <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                    私有
                  </span>
                ) : null}
              </div>
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

      {created === "1" ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            应用已创建{version ? `，首个版本 v${version} 已发布` : ""}
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-700 dark:text-emerald-400">
            已进入该应用的管理页：下方可直接上传新版本、维护截图，页面最底部可继续修改基础信息。
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section id="releases" className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">版本管理</h2>
            <ReleaseManager appId={app.id} appType={app.type} releases={releaseData} />
          </section>

          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">截图管理</h2>
            <ScreenshotManager appId={app.id} screenshots={app.screenshots} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-5">
            <h2 className="mb-3 text-sm font-semibold">应用图标</h2>
            <IconUploader appId={app.id} iconUrl={app.iconUrl} />
          </section>

          <section className="surface p-5 text-xs text-neutral-500 dark:text-neutral-400">
            <h2 className="mb-3 text-sm font-semibold text-neutral-900 dark:text-neutral-50">记录信息</h2>
            <dl className="space-y-2">
              <div className="flex justify-between gap-3">
                <dt>应用 ID</dt>
                <dd className="truncate font-mono text-[11px]">{app.id}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>创建时间</dt>
                <dd>{formatDateTime(record.createdAt.toISOString())}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>最近更新</dt>
                <dd>{formatDateTime(record.updatedAt.toISOString())}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>下载次数</dt>
                <dd>{record.downloadCount}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-rose-200 bg-white p-5 dark:border-rose-500/30 dark:bg-neutral-900">
            <h2 className="mb-2 text-sm font-semibold text-rose-600 dark:text-rose-300">危险操作</h2>
            <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
              删除后应用、版本记录与磁盘文件将一并清除。
            </p>
            <DeleteAppButton appId={app.id} appName={app.name} />
          </section>
        </aside>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">基础信息</h2>
        <AppForm
          mode="edit"
          app={app}
          categories={facets.categories}
          tagOptions={facets.tags}
          developerOptions={developers.map((developer) => ({
            id: developer.id,
            username: developer.username,
            displayName: developer.displayName,
          }))}
        />
      </section>
    </div>
  );
}

/**
 * 后台应用详情页。
 * @param props.params 路由参数
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function AdminAppDetailPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: RouteSearchParams;
}) {
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
      <AdminAppContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
