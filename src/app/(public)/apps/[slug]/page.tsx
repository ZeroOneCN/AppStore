import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { DownloadButton } from "@/components/download-button";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { formatBytes, formatDateTime } from "@/lib/format";
import { isAppError } from "@/server/infra/errors";
import { getAppBySlug, type AppDetailDto } from "@/server/services/app.service";

/** 动态路由参数 */
type RouteParams = Promise<{ slug: string }>;

/**
 * 详情页数据区：加载应用详情并渲染主体内容。
 * @param props.params 路由参数
 * @returns 详情内容
 */
async function AppDetailContent({ params }: { params: RouteParams }) {
  await connection();
  const { slug } = await params;

  let app: AppDetailDto;
  try {
    app = await getAppBySlug(slug);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const release = app.currentRelease;

  return (
    <div className="flex flex-1 flex-col py-6 sm:py-8">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1 text-sm text-neutral-500 transition hover:text-brand dark:text-neutral-400"
      >
        ← 返回应用墙
      </Link>

      <div className="mt-4 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          {/* 应用头部：iOS 应用页式的居中图标与标题 */}
          <header className="card-apple flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:items-start sm:p-7 sm:text-left">
            <AppIcon name={app.name} iconUrl={app.iconUrl} size={88} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="max-w-full truncate text-[26px] font-semibold tracking-tight sm:text-3xl">
                  {app.name}
                </h1>
                {app.pinned ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    置顶
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    app.type === "ANDROID"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                  }`}
                >
                  {app.type === "ANDROID" ? "Android" : "网页"}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{app.summary}</p>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-neutral-500 sm:justify-start dark:text-neutral-400">
                <span>{app.category}</span>
                <span aria-hidden>·</span>
                <span>更新于 {formatDateTime(app.updatedAt)}</span>
                <span aria-hidden>·</span>
                <span>{app.downloadCount} 次下载</span>
              </div>

              {app.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {app.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </header>

          <section className="card-apple p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              应用介绍
            </h2>
            <p className="mt-2.5 whitespace-pre-line break-words text-sm leading-7 text-neutral-700 dark:text-neutral-300">
              {app.description || "暂无详细介绍。"}
            </p>
          </section>

          <section className="card-apple p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              截图
            </h2>
            <div className="mt-3">
              <ScreenshotGallery images={app.screenshots} name={app.name} />
            </div>
          </section>

          {release && release.changelog ? (
            <section className="card-apple p-5 sm:p-6">
              <h2 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                更新日志 · v{release.versionName}
              </h2>
              <p className="mt-2.5 whitespace-pre-line text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {release.changelog}
              </p>
            </section>
          ) : null}

          {app.type === "ANDROID" && app.releases.length > 0 ? (
            <section className="card-apple p-5 sm:p-6">
              <h2 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
                历史版本
              </h2>
              <ul className="mt-3 divide-y divide-black/[0.05] text-sm dark:divide-white/[0.08]">
                {app.releases.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate">
                      v{item.versionName}
                      <span className="ml-2 text-xs text-neutral-400">({item.versionCode})</span>
                      {item.status === "ARCHIVED" ? (
                        <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          已归档
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {formatDateTime(item.publishedAt)}
                      </span>
                      <DownloadButton releaseId={item.id} label="下载" variant="ghost" />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="card-apple p-5 sm:p-6">
            <h2 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase dark:text-neutral-400">
              获取应用
            </h2>

            {app.type === "ANDROID" ? (
              release ? (
                <div className="mt-3 space-y-3">
                  <div className="text-sm">
                    <p className="font-semibold">当前版本 v{release.versionName}</p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {formatBytes(release.fileSize)}
                      {release.minSdk ? ` · 最低 Android API ${release.minSdk}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      发布于 {formatDateTime(release.publishedAt)}
                    </p>
                  </div>

                  <DownloadButton releaseId={release.id} className="w-full" />

                  <div>
                    <p className="text-[11px] text-neutral-400">SHA-256 校验值</p>
                    <p className="mt-1 break-all font-mono text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
                      {release.sha256}
                    </p>
                  </div>

                  {release.forceUpdate ? (
                    <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      该版本为强制更新版本，客户端需升级后才能继续使用。
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                  暂无可下载版本，请等待管理员发布安装包。
                </p>
              )
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  这是一个网页作品，点击下方按钮在浏览器中打开。
                </p>
                {app.webUrl ? (
                  <a
                    href={app.webUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="btn-primary w-full"
                  >
                    打开作品
                  </a>
                ) : (
                  <p className="text-xs text-neutral-400">未配置访问链接</p>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * 详情页骨架屏。
 * @returns 占位结构
 */
function DetailSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col py-6 sm:py-8">
      <div className="h-4 w-24 rounded bg-black/[0.06] dark:bg-white/10" />
      <div className="mt-4 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
          <div className="h-48 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
        <div className="h-64 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
      </div>
    </div>
  );
}

/**
 * 应用详情页。
 * @param props.params 路由参数
 * @returns 页面内容
 */
export default function AppDetailPage({ params }: { params: RouteParams }) {
  return (
    <section className="page-shell flex flex-1 flex-col">
      <Suspense fallback={<DetailSkeleton />}>
        <AppDetailContent params={params} />
      </Suspense>
    </section>
  );
}
