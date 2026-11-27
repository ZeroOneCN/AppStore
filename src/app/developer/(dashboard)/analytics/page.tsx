import { connection } from "next/server";
import { Suspense } from "react";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { PageHeader } from "@/components/page-header";
import { getAnalyticsOverview } from "@/server/services/analytics.service";
import { requireDeveloperPage } from "@/server/http/guards";

/** 查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 阅读时间范围参数：自定义起止日期优先，否则取预设天数。
 * @param params 查询参数
 * @returns 统计范围与当前预设
 */
function readRange(params: Record<string, string | string[] | undefined>): {
  days: number;
  start?: string;
  end?: string;
  preset: number | null;
} {
  const pick = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const start = pick(params.start);
  const end = pick(params.end);
  if (start && end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { days: 30, start, end, preset: null };
  }

  const rawDays = Number(pick(params.days));
  const days = [7, 30, 90, 365].includes(rawDays) ? rawDays : 30;
  return { days, preset: days };
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
  const range = readRange(params);
  const data = await getAnalyticsOverview({
    days: range.days,
    start: range.start,
    end: range.end,
    developerId: session.sub,
  });

  return (
    <div className="w-full">
      <PageHeader title="数据统计" description="你的应用流量、下载来源、安装与设备分布" />
      <AnalyticsDashboard
        data={data}
        appHrefBase="/developer/apps"
        rangeBasePath="/developer/analytics"
        preset={range.preset}
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
