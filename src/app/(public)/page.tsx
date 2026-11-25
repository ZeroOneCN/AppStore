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
 * 顶部统计项。
 * @param props.label 说明文字
 * @param props.value 数值
 * @returns 统计卡片
 */
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white/80 px-4 py-3 text-center backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.06]">
      <dt className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * 应用墙数据区：读取筛选参数、查询数据并渲染全宽布局。
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
  const filtered = Boolean(filters.q || filters.type || filters.category || filters.tag);

  return (
    <div className="flex flex-1 flex-col py-6 sm:py-8">
      {/* 顶部品牌区：全宽铺满并展示统计信息 */}
      <header className="relative overflow-hidden rounded-[28px] border border-black/[0.06] bg-white/70 px-6 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-md sm:px-10 sm:py-9 dark:border-white/10 dark:bg-white/[0.04]">
        <div className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-brand/5 blur-3xl" />

        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/[0.06] px-3 py-1 text-[11px] font-medium tracking-wide text-brand">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {filtered ? "筛选结果" : "个人应用商店"}
            </span>
            <h1 className="mt-4 text-[32px] leading-[1.1] font-semibold tracking-[-0.02em] sm:text-[42px]">
              {filtered ? "找到这些作品" : "发现你的应用"}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-6 text-neutral-500 dark:text-neutral-400">
              {filtered
                ? `共 ${items.length} 个符合条件的作品，可继续调整筛选条件`
                : "自建分发中心，Android 应用与网页作品统一管理与下载"}
            </p>
          </div>

          <dl className="grid w-full grid-cols-3 gap-3 lg:w-auto lg:min-w-[360px]">
            <Stat label="作品总数" value={allItems.length} />
            <Stat label="Android" value={androidCount} />
            <Stat label="网页作品" value={webCount} />
          </dl>
        </div>
      </header>

      <div className="mt-5">
        <FilterBar categories={categories} tags={tags} />
      </div>

      {items.length === 0 ? (
        <div className="card-apple mt-5 grid min-h-[320px] flex-1 place-items-center px-6 text-center">
          <div>
            <p className="text-base font-medium">
              {filtered ? "没有符合条件的应用" : "还没有发布任何应用"}
            </p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {filtered ? "试试更换关键词或清空筛选条件" : "管理员发布应用后会显示在这里"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid flex-1 auto-rows-fr content-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {items.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 应用墙骨架屏。
 * @returns 占位结构
 */
function WallSkeleton() {
  return (
    <div className="flex flex-1 animate-pulse flex-col py-6 sm:py-8">
      <div className="h-[190px] rounded-[28px] bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-5 h-36 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-5 grid flex-1 content-start gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-40 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
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
    <section className="page-shell flex flex-1 flex-col">
      <Suspense fallback={<WallSkeleton />}>
        <AppWall searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
