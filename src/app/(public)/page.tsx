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
 * 应用墙数据区：读取筛选参数、查询数据并渲染居中布局的卡片网格。
 * @param props.searchParams 地址栏查询参数
 * @returns 品牌区、筛选栏与卡片网格
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
    <div className="page-center py-10 sm:py-14">
      {/* 品牌区：大标题居中，作为页面视觉重心 */}
      <header className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          {filtered ? "筛选结果" : "个人应用商店"}
        </span>
        <h1 className="mt-5 text-[34px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-5xl">
          {filtered ? "找到这些作品" : "发现你的应用"}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-[15px] leading-6 text-neutral-500 dark:text-neutral-400">
          {filtered
            ? `共 ${items.length} 个符合条件的作品，试试调整筛选条件`
            : `共 ${items.length} 个作品 · 自建分发，下载即安装`}
        </p>
      </header>

      <div className="mx-auto mt-8 w-full max-w-5xl">
        <FilterBar categories={categories} tags={tags} />
      </div>

      <div className="mx-auto w-full max-w-6xl">
        {items.length === 0 ? (
          <div className="card-apple mx-auto mt-6 grid max-w-lg place-items-center px-6 py-14 text-center">
            <p className="text-base font-medium">
              {filtered ? "没有符合条件的应用" : "还没有发布任何应用"}
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {filtered ? "试试更换关键词或清空筛选条件" : "管理员发布应用后会显示在这里"}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] sm:gap-4">
            {items.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 应用墙骨架屏。
 * @returns 占位结构
 */
function WallSkeleton() {
  return (
    <div className="page-center animate-pulse py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mx-auto h-5 w-24 rounded-full bg-black/[0.06] dark:bg-white/10" />
        <div className="mx-auto mt-5 h-10 w-72 max-w-full rounded-xl bg-black/[0.06] dark:bg-white/10" />
        <div className="mx-auto mt-3 h-4 w-56 max-w-full rounded bg-black/[0.05] dark:bg-white/[0.07]" />
      </div>
      <div className="mx-auto mt-8 h-36 w-full max-w-5xl rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mx-auto mt-6 grid w-full max-w-6xl gap-3 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))] sm:gap-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
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
    <section className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <Suspense fallback={<WallSkeleton />}>
        <AppWall searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
