import { connection } from "next/server";
import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/page-header";
import { getAnalyticsOverview } from "@/server/services/analytics.service";
import { requireDeveloperPage } from "@/server/http/guards";

/** 查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

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
 * 开发者数据统计：仅统计当前开发者名下应用的 PV、下载与安装数据。
 * @param props.searchParams 查询参数
 * @returns 统计内容
 */
async function DeveloperAnalyticsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await requireDeveloperPage("/developer/analytics");

  const params = await searchParams;
  const days = readDays(params);
  const data = await getAnalyticsOverview({ days, developerId: session.sub });

  return (
    <div className="w-full">
      <PageHeader title="数据统计" description="你的应用流量、下载来源、安装与设备分布" />
      <AnalyticsDashboard
        data={data}
        appHrefBase="/developer/apps"
        rangeBasePath="/developer/analytics"
        days={days}
      />
    </div>
  );
}

/**
 * 开发者数据统计页。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function DeveloperAnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
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
      <DeveloperAnalyticsContent searchParams={searchParams} />
    </Suspense>
  );
}
