import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getAdminStats } from "@/server/services/app.service";
import { getAnalyticsOverview } from "@/server/services/analytics.service";
import { requireAdminPage } from "@/server/http/guards";

/** 查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 统计指标卡片。
 * @param props.label 指标名称
 * @param props.value 指标数值
 * @param props.hint 补充说明
 * @returns 统计卡片
 */
function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card-apple px-4 py-4">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value.toLocaleString("zh-CN")}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}

/**
 * 阅读时间范围参数，仅允许 7 / 30 / 90。
 * @param params 查询参数
 * @returns 天数
 */
function readDays(params: Record<string, string | string[] | undefined>): number {
  const raw = Array.isArray(params.days) ? params.days[0] : params.days;
  const value = Number(raw);
  return [7, 30, 90].includes(value) ? value : 30;
}

/**
 * 统计页数据区。
 * @param props.searchParams 查询参数
 * @returns 流量、下载、安装分析与应用规模
 */
async function StatsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireAdminPage();

  const params = await searchParams;
  const days = readDays(params);
  const [analytics, stats] = await Promise.all([
    getAnalyticsOverview({ days }),
    getAdminStats(),
  ]);

  return (
    <div className="w-full">
      <PageHeader title="数据统计" description="页面流量、下载来源、安装构成与设备分布" />

      <AnalyticsDashboard
        data={analytics}
        appHrefBase="/admin/apps"
        rangeBasePath="/admin/stats"
        days={days}
      />

      <section className="mt-6">
        <h2 className="text-sm font-semibold">应用规模</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="应用总数" value={stats.appTotal} hint={`Android ${stats.androidCount} · 网页 ${stats.webCount}`} />
          <MetricCard label="已发布应用" value={stats.publishedCount} hint="至少有一个正式版本" />
          <MetricCard label="版本总数" value={stats.releaseTotal} hint="包含草稿与已归档" />
          <MetricCard label="累计下载" value={stats.totalDownloads} hint="按成功响应计数" />
        </div>
      </section>
    </div>
  );
}

/**
 * 后台统计页。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function AdminStatsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-[104px] rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      }
    >
      <StatsContent searchParams={searchParams} />
    </Suspense>
  );
}
