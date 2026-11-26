import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-card";
import { formatDateTime } from "@/lib/format";
import { listAdminApps } from "@/server/services/app.service";
import { requireAdminPage } from "@/server/http/guards";

/** 每页展示的应用数量 */
const PAGE_SIZE = 12;

/** 后台列表查询参数 */
type AdminAppsSearchParams = Promise<{
  q?: string;
  type?: string;
  visibility?: string;
  sort?: string;
  page?: string;
}>;

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
 * 生成带查询参数的列表地址。
 * @param params 当前查询参数
 * @param overrides 需要覆盖的键值，值为空表示移除
 * @returns 列表地址
 */
function buildHref(
  params: Record<string, string>,
  overrides: Record<string, string | undefined>,
): string {
  const merged: Record<string, string> = { ...params };
  for (const [key, value] of Object.entries(overrides)) {
    if (value) merged[key] = value;
    else delete merged[key];
  }
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/apps?${query}` : "/admin/apps";
}

/**
 * 后台应用列表数据区。
 * @param props.searchParams 关键词、类型、可见性、排序与页码
 * @returns 概览统计、筛选栏与应用卡片网格
 */
async function AppsContent({ searchParams }: { searchParams: AdminAppsSearchParams }) {
  await connection();
  await requireAdminPage();
  const raw = await searchParams;
  const apps = await listAdminApps();

  const q = (raw.q ?? "").trim();
  const type = raw.type === "ANDROID" || raw.type === "WEB" ? raw.type : "";
  const visibility = raw.visibility === "PUBLIC" || raw.visibility === "PRIVATE" ? raw.visibility : "";
  const sort = raw.sort === "name" || raw.sort === "downloads" ? raw.sort : "recent";
  const activeParams: Record<string, string> = {};
  if (q) activeParams.q = q;
  if (type) activeParams.type = type;
  if (visibility) activeParams.visibility = visibility;
  if (sort !== "recent") activeParams.sort = sort;

  const keyword = q.toLowerCase();
  const filtered = apps.filter((app) => {
    if (type && app.type !== type) return false;
    if (visibility && app.visibility !== visibility) return false;
    if (!keyword) return true;
    return (
      app.name.toLowerCase().includes(keyword) ||
      app.slug.toLowerCase().includes(keyword) ||
      app.summary.toLowerCase().includes(keyword) ||
      (app.packageName ?? "").toLowerCase().includes(keyword)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "zh-CN");
    if (sort === "downloads") return b.downloadCount - a.downloadCount;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(raw.page) || 1), totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

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

      <form
        method="get"
        className="card-apple mb-5 flex flex-wrap items-center gap-2 p-3"
        aria-label="应用筛选"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="搜索名称、标识、简介或包名"
          className="input-apple h-10 min-w-[180px] flex-1"
          aria-label="关键词搜索"
        />
        <select name="type" defaultValue={type} className="input-apple h-10 w-auto" aria-label="类型筛选">
          <option value="">全部类型</option>
          <option value="ANDROID">Android</option>
          <option value="WEB">网页作品</option>
        </select>
        <select
          name="visibility"
          defaultValue={visibility}
          className="input-apple h-10 w-auto"
          aria-label="可见性筛选"
        >
          <option value="">全部可见性</option>
          <option value="PUBLIC">公开</option>
          <option value="PRIVATE">私有</option>
        </select>
        <select name="sort" defaultValue={sort} className="input-apple h-10 w-auto" aria-label="排序方式">
          <option value="recent">最近更新</option>
          <option value="name">名称</option>
          <option value="downloads">下载次数</option>
        </select>
        <button type="submit" className="btn-secondary h-10">
          筛选
        </button>
        <Link href="/admin/apps" className="px-2 text-xs text-neutral-500 transition hover:text-brand dark:text-neutral-400">
          重置
        </Link>
      </form>

      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        共 {sorted.length} 个应用
        {sorted.length > PAGE_SIZE ? ` · 第 ${currentPage}/${totalPages} 页` : ""}
        {q || type || visibility ? "（已筛选）" : ""}
      </p>

      {apps.length === 0 ? (
        <div className="card-apple grid min-h-[420px] place-items-center px-6 text-center">
          <p className="text-base font-medium">还没有应用</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            先创建应用，再上传 APK 或填写网页链接
          </p>
          <Link href="/admin/apps/new" className="btn-primary mt-5">
            新建应用
          </Link>
        </div>
      ) : pageItems.length === 0 ? (
        <div className="card-apple grid min-h-[260px] place-items-center px-6 text-center">
          <p className="text-base font-medium">没有匹配的应用</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            换个关键词，或清除筛选条件后重试
          </p>
          <Link href="/admin/apps" className="btn-secondary mt-5">
            清除筛选
          </Link>
        </div>
      ) : (
        <>
          <div className="grid auto-rows-fr gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {pageItems.map((app) => (
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
                  {app.developer ? (
                    <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      {app.developer.displayName || app.developer.username}
                    </span>
                  ) : null}
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

          {totalPages > 1 ? (
            <nav className="mt-6 flex items-center justify-center gap-2 text-sm" aria-label="分页">
              {currentPage > 1 ? (
                <Link href={buildHref(activeParams, { page: String(currentPage - 1) })} className="btn-secondary">
                  上一页
                </Link>
              ) : null}
              <span className="px-2 text-xs text-neutral-500 dark:text-neutral-400">
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={buildHref(activeParams, { page: String(currentPage + 1) })} className="btn-secondary">
                  下一页
                </Link>
              ) : null}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}

/**
 * 后台应用列表页。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function AdminAppsPage({ searchParams }: { searchParams: AdminAppsSearchParams }) {
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
          <div className="mt-6 h-16 rounded-2xl bg-black/[0.04] dark:bg-white/[0.06]" />
          <div className="mt-6 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            ))}
          </div>
        </div>
      }
    >
      <AppsContent searchParams={searchParams} />
    </Suspense>
  );
}
