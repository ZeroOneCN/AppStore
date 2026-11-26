import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppCard } from "@/components/app-card";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { APP_TYPES, type AppType } from "@/server/infra/constants";
import { listPublicApps, type AppListFilters } from "@/server/services/app.service";

/** 应用广场查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** 允许的排序值 */
const SORTS: NonNullable<AppListFilters["sort"]>[] = ["recent", "name", "downloads"];

/**
 * 读取单值查询参数。
 * @param params 查询参数对象
 * @param key 参数名
 * @returns 字符串值或 undefined
 */
function readParam(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const value = params[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

/**
 * 应用广场数据区：筛选、统计与卡片网格。
 * @param props.searchParams 地址栏查询参数
 * @returns 页面主体
 */
async function AppsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const params = await searchParams;

  const typeValue = readParam(params, "type");
  const sortValue = readParam(params, "sort");
  const filters: AppListFilters = {
    q: readParam(params, "q")?.slice(0, 50) || undefined,
    category: readParam(params, "category")?.slice(0, 50) || undefined,
    tag: readParam(params, "tag")?.slice(0, 50) || undefined,
    type: APP_TYPES.includes(typeValue as AppType) ? (typeValue as AppType) : undefined,
    sort: SORTS.includes(sortValue as NonNullable<AppListFilters["sort"]>)
      ? (sortValue as NonNullable<AppListFilters["sort"]>)
      : undefined,
  };

  // 同时取未筛选数据用于生成分类、标签与顶部统计
  const [items, allItems] = await Promise.all([listPublicApps(filters), listPublicApps({})]);

  const categories = Array.from(new Set(allItems.map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const tags = Array.from(new Set(allItems.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

  const androidCount = allItems.filter((item) => item.type === "ANDROID").length;
  const webCount = allItems.length - androidCount;
  const downloads = allItems.reduce((sum, item) => sum + item.downloadCount, 0);
  const filtered = Boolean(filters.q || filters.type || filters.category || filters.tag);

  return (
    <div className="page-shell flex flex-1 flex-col py-8 sm:py-10">
      <header className="page-header">
        <div className="min-w-0">
          <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-brand uppercase">
            {filtered ? "筛选结果" : "应用广场"}
          </p>
          <h1 className="page-title">{filtered ? "符合条件的应用" : "发现值得一试的作品"}</h1>
          <p className="page-desc">
            {filtered
              ? `共 ${items.length} 个符合条件的作品，可继续调整筛选条件`
              : "Android 应用与网页作品统一收录，支持历史版本下载与包体校验"}
          </p>
        </div>

        <dl className="grid w-full grid-cols-3 gap-2.5 sm:w-auto sm:min-w-[340px]">
          <StatCard label="作品" value={allItems.length} />
          <StatCard label="Android" value={androidCount} />
          <StatCard label="网页" value={webCount} />
        </dl>
      </header>

      <div className="mt-6">
        <FilterBar categories={categories} tags={tags} />
      </div>

      <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
        共 {items.length} 个应用 · 累计下载 {downloads} 次
      </p>

      {items.length === 0 ? (
        <div className="mt-4 flex flex-1 flex-col">
          <EmptyState
            title={filtered ? "没有符合条件的应用" : "还没有发布任何应用"}
            description={
              filtered ? "试试更换关键词或清空筛选条件" : "管理员发布应用后会显示在这里"
            }
            action={
              filtered ? (
                <Link href="/apps" className="btn-secondary">
                  清除筛选
                </Link>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid flex-1 auto-rows-fr content-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {items.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 应用广场骨架屏。
 * @returns 占位结构
 */
function AppsSkeleton() {
  return (
    <div className="page-shell flex flex-1 animate-pulse flex-col py-8 sm:py-10">
      <div className="h-20 w-full max-w-xl rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-6 h-32 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-4 grid flex-1 content-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-44 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        ))}
      </div>
    </div>
  );
}

/**
 * 应用广场页。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function AppsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<AppsSkeleton />}>
      <AppsContent searchParams={searchParams} />
    </Suspense>
  );
}
