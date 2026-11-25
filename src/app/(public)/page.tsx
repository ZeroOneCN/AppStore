import { Suspense } from "react";
import { connection } from "next/server";
import { AppCard } from "@/components/app-card";
import { FilterBar } from "@/components/filter-bar";
import { APP_TYPES, type AppType } from "@/server/infra/constants";
import { listPublicApps, type AppListFilters } from "@/server/services/app.service";

/** 首页查询参数 */
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
 * 应用墙数据区：读取筛选参数、查询数据并渲染卡片网格。
 * @param props.searchParams 地址栏查询参数
 * @returns 筛选栏与卡片网格
 */
async function AppWall({ searchParams }: { searchParams: SearchParams }) {
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

  // 同时取未筛选数据用于生成分类与标签选项
  const [items, allItems] = await Promise.all([listPublicApps(filters), listPublicApps({})]);

  const categories = Array.from(new Set(allItems.map((item) => item.category))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );
  const tags = Array.from(new Set(allItems.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b, "zh-CN"),
  );

  const filtered = Boolean(filters.q || filters.type || filters.category || filters.tag);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">应用墙</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            {filtered ? `筛选出 ${items.length} 个作品` : `共 ${items.length} 个作品`}
          </p>
        </div>
      </div>

      <FilterBar categories={categories} tags={tags} />

      {items.length === 0 ? (
        <div className="mt-8 grid place-items-center rounded-2xl border border-dashed border-neutral-300 px-6 py-16 text-center dark:border-neutral-700">
          <p className="text-base font-medium">
            {filtered ? "没有符合条件的应用" : "还没有发布任何应用"}
          </p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            {filtered ? "试试更换关键词或清空筛选条件" : "管理员发布应用后会显示在这里"}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {items.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * 应用墙骨架屏。
 * @returns 占位结构
 */
function WallSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-5 h-8 w-32 rounded-md bg-neutral-200 dark:bg-neutral-800" />
      <div className="h-28 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  );
}

/**
 * 前台首页（应用墙）。
 * @param props.searchParams 地址栏查询参数
 * @returns 页面内容
 */
export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Suspense fallback={<WallSkeleton />}>
        <AppWall searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
