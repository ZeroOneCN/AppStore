import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { AppIcon } from "@/components/app-card";
import { DownloadButton } from "@/components/download-button";
import { ScreenshotGallery } from "@/components/screenshot-gallery";
import { formatBytes, formatDateTime } from "@/lib/format";
import { isAppError } from "@/server/infra/errors";
import { getAppBySlug, type AppDetailDto } from "@/server/services/app.service";

/** 动态路由参数 */
type RouteParams = Promise<{ slug: string }>;

/** 同一请求内复用应用详情查询 */
const loadApp = cache(async (slug: string): Promise<AppDetailDto> => getAppBySlug(slug));

/**
 * 详情页元数据：应用不存在时直接返回 404，避免流式渲染出现软 404。
 * @param props.params 路由参数
 * @returns 页面元数据
 */
export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const app = await loadApp(slug);
    return { title: app.name, description: app.summary };
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }
}

/**
 * 信息卡中的单行字段。
 * @param props.label 字段名
 * @param props.children 字段值
 * @returns 信息行
 */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] py-2.5 text-[13px] last:border-0 dark:border-white/[0.08]">
      <span className="shrink-0 text-neutral-500 dark:text-neutral-400">{label}</span>
      <span className="min-w-0 text-right font-medium break-words">{children}</span>
    </div>
  );
}

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
    app = await loadApp(slug);
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") notFound();
    throw error;
  }

  const release = app.currentRelease;

  return (
    <div className="page-shell flex flex-1 flex-col py-8 sm:py-10">
      <nav className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400" aria-label="面包屑">
        <Link href="/" className="transition hover:text-brand">
          首页
        </Link>
        <span aria-hidden>/</span>
        <Link href="/apps" className="transition hover:text-brand">
          应用广场
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-neutral-700 dark:text-neutral-200">{app.name}</span>
      </nav>

      {/* 应用头部：图标、名称、简介与主操作 */}
      <header className="surface mt-4 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
        <AppIcon name={app.name} iconUrl={app.iconUrl} size={92} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="max-w-full truncate text-[26px] font-semibold tracking-tight sm:text-[32px]">
              {app.name}
            </h1>
            {app.pinned ? <span className="chip">置顶</span> : null}
            <span className="chip">{app.type === "ANDROID" ? "Android" : "网页作品"}</span>
          </div>

          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{app.summary}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
            <span>{app.category}</span>
            <span>更新于 {formatDateTime(app.updatedAt)}</span>
            <span>{app.downloadCount} 次下载</span>
            {release ? <span>当前 v{release.versionName}</span> : null}
          </div>

          {app.tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {app.tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:w-44">
          {app.type === "ANDROID" ? (
            release ? (
              <DownloadButton releaseId={release.id} className="w-full" />
            ) : (
              <p className="text-center text-xs text-neutral-400">暂无可下载版本</p>
            )
          ) : app.webUrl ? (
            <a href={app.webUrl} target="_blank" rel="noreferrer noopener" className="btn-primary w-full">
              打开作品
            </a>
          ) : (
            <p className="text-center text-xs text-neutral-400">未配置访问链接</p>
          )}
          {app.type === "ANDROID" && release ? (
            <p className="text-center text-[11px] text-neutral-400">
              {formatBytes(release.fileSize)} · v{release.versionName}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="surface p-6">
            <h2 className="text-sm font-semibold">应用介绍</h2>
            <p className="mt-3 max-w-3xl whitespace-pre-line break-words text-sm leading-7 text-neutral-700 dark:text-neutral-300">
              {app.description || "暂无详细介绍。"}
            </p>
          </section>

          {app.screenshots.length > 0 ? (
            <section className="surface p-6">
              <h2 className="text-sm font-semibold">截图</h2>
              <div className="mt-4">
                <ScreenshotGallery images={app.screenshots} name={app.name} />
              </div>
            </section>
          ) : null}

          {release?.changelog ? (
            <section className="surface p-6">
              <h2 className="text-sm font-semibold">更新日志 · v{release.versionName}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {release.changelog}
              </p>
            </section>
          ) : null}

          {app.type === "ANDROID" && app.releases.length > 0 ? (
            <section className="surface p-6">
              <h2 className="text-sm font-semibold">历史版本</h2>
              <ul className="mt-2 divide-y divide-black/[0.05] text-sm dark:divide-white/[0.08]">
                {app.releases.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">v{item.versionName}</span>
                      <span className="ml-2 text-xs text-neutral-400">（{item.versionCode}）</span>
                      {item.status === "ARCHIVED" ? (
                        <span className="chip ml-2">已归档</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="hidden text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                        {formatDateTime(item.publishedAt)}
                      </span>
                      <DownloadButton
                        releaseId={item.id}
                        label="下载"
                        variant="ghost"
                        ariaLabel={`下载 v${item.versionName}`}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface p-6">
            <h2 className="text-sm font-semibold">应用信息</h2>
            <div className="mt-2">
              {app.packageName ? <InfoRow label="包名">{app.packageName}</InfoRow> : null}
              {release ? <InfoRow label="大小">{formatBytes(release.fileSize)}</InfoRow> : null}
              {release?.minSdk ? <InfoRow label="最低系统">Android API {release.minSdk}</InfoRow> : null}
              {release?.publishedAt ? (
                <InfoRow label="发布时间">{formatDateTime(release.publishedAt)}</InfoRow>
              ) : null}
              {app.type === "WEB" ? <InfoRow label="类型">网页作品</InfoRow> : null}
              <InfoRow label="开发者">
                {app.developer ? (
                  <span>
                    {app.developer.displayName || app.developer.username}
                    {app.developer.displayName ? (
                      <span className="ml-1.5 text-[11px] font-normal text-neutral-400">
                        @{app.developer.username}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span>平台官方</span>
                )}
              </InfoRow>
              <InfoRow label="下载次数">{app.downloadCount}</InfoRow>
            </div>

            {release ? (
              <div className="mt-4">
                <p className="text-[11px] text-neutral-400">SHA-256 校验值</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
                  {release.sha256}
                </p>
              </div>
            ) : null}

            {release?.forceUpdate ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                该版本为强制更新版本，客户端需升级后才能继续使用。
              </p>
            ) : null}

            <Link
              href="/docs"
              className="mt-5 inline-flex text-xs font-medium text-brand transition hover:text-brand-deep"
            >
              在客户端接入更新检查 →
            </Link>
          </div>

          <div className="surface mt-4 p-6">
            <h2 className="text-sm font-semibold">加入分发</h2>
            <p className="mt-2 text-xs leading-6 text-neutral-500 dark:text-neutral-400">
              开发者账号由管理员创建，登录后可上传 APK、管理版本与查看下载数据。
            </p>
            <Link href="/login" className="btn-secondary mt-4 w-full">
              开发者登录
            </Link>
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
    <div className="page-shell flex flex-1 animate-pulse flex-col py-8 sm:py-10">
      <div className="h-4 w-40 rounded bg-black/[0.06] dark:bg-white/10" />
      <div className="mt-4 h-36 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-6 grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="h-44 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
          <div className="h-56 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
        <div className="h-64 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
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
    <Suspense fallback={<DetailSkeleton />}>
      <AppDetailContent params={params} />
    </Suspense>
  );
}
