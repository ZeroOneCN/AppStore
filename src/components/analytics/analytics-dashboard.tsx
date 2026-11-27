import Link from "next/link";
import type { AnalyticsBreakdown, AnalyticsOverview, AnalyticsPoint } from "@/server/services/analytics.service";

/**
 * 指标卡片。
 * @param props.label 指标名
 * @param props.value 主数值
 * @param props.hint 辅助说明
 * @param props.tone 强调色
 * @returns 指标卡片
 */
function MetricCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="card-apple px-4 py-4">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${
          tone === "brand" ? "text-brand" : ""
        }`}
      >
        {value.toLocaleString("zh-CN")}
      </p>
      <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}

/**
 * 趋势柱状图：按天展示 PV 与下载量。
 * @param props.series 单日数据
 * @returns 图表
 */
function TrendChart({ series }: { series: AnalyticsPoint[] }) {
  const max = Math.max(1, ...series.map((point) => Math.max(point.pv, point.downloads)));
  const step = series.length > 60 ? 15 : series.length > 20 ? 5 : 1;

  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {series.map((point) => (
          <div
            key={point.date}
            className="group flex h-full min-w-0 flex-1 items-end justify-center gap-[2px]"
            title={`${point.date} · PV ${point.pv} · UV ${point.uv} · 下载 ${point.downloads}`}
          >
            <span
              className="w-full max-w-[7px] rounded-t bg-brand/75 transition group-hover:bg-brand"
              style={{ height: `${Math.max(2, (point.pv / max) * 100)}%` }}
            />
            <span
              className="w-full max-w-[7px] rounded-t bg-emerald-500/70 transition group-hover:bg-emerald-500"
              style={{ height: `${Math.max(2, (point.downloads / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {series.map((point, index) => (
          <span
            key={point.date}
            className="min-w-0 flex-1 text-center text-[10px] text-neutral-400"
          >
            {index % step === 0 ? point.date.slice(5).replace("-", "/") : ""}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-4 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-brand/75" />
          PV
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500/70" />
          下载
        </span>
      </div>
    </div>
  );
}

/**
 * 分布列表：名称 + 占比条 + 数量。
 * @param props.title 标题
 * @param props.items 分布数据
 * @param props.emptyText 空状态文案
 * @returns 分布卡片
 */
function BreakdownCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: AnalyticsBreakdown[];
  emptyText: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="card-apple p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-6 text-center text-xs text-neutral-400">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item.name}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-neutral-600 dark:text-neutral-300">{item.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-400">{item.count}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-brand/70"
                  style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 安装构成卡片：首次安装与更新安装的占比。
 * @param props.overview 概览数据
 * @returns 安装构成
 */
function InstallSplit({ overview }: { overview: AnalyticsOverview }) {
  const { newInstalls, updates, uniqueDevices } = overview.totals;
  const total = newInstalls + updates;
  const installPercent = total === 0 ? 0 : Math.round((newInstalls / total) * 100);

  return (
    <section className="card-apple flex flex-col p-5">
      <h2 className="text-sm font-semibold">安装构成</h2>
      {total === 0 ? (
        <p className="mt-6 text-center text-xs text-neutral-400">
          暂无安装上报，接入上报接口后可在设备安装时累计
        </p>
      ) : (
        <>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{total}</p>
              <p className="mt-1 text-[11px] text-neutral-400">安装上报总数</p>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              独立设备 <span className="font-medium text-neutral-700 dark:text-neutral-200">{uniqueDevices}</span>
            </p>
          </div>
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-black/[0.05] dark:bg-white/10">
            <div className="h-full bg-brand" style={{ width: `${installPercent}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${100 - installPercent}%` }} />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <span className="h-2 w-2 rounded-sm bg-brand" />
                首次安装
              </span>
              <span className="tabular-nums text-neutral-400">{newInstalls}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                <span className="h-2 w-2 rounded-sm bg-amber-400" />
                更新安装
              </span>
              <span className="tabular-nums text-neutral-400">{updates}</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * 统计仪表盘：KPI、趋势、安装构成、渠道与设备分布、应用排行。
 * @param props.data 概览数据
 * @param props.appHrefBase 应用详情链接前缀，如 /admin/apps
 * @param props.rangeBasePath 时间范围切换的基础路径
 * @param props.days 当前时间范围
 * @returns 仪表盘
 */
export function AnalyticsDashboard({
  data,
  appHrefBase,
  rangeBasePath,
  days,
}: {
  data: AnalyticsOverview;
  appHrefBase: string;
  rangeBasePath: string;
  days: number;
}) {
  const ranges = [7, 30, 90];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          {ranges.map((range) => (
            <Link
              key={range}
              href={`${rangeBasePath}?days=${range}`}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${
                days === range
                  ? "bg-white font-medium text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
              }`}
            >
              {range} 天
            </Link>
          ))}
        </div>
        <p className="text-[11px] text-neutral-400">
          {data.hasData ? `统计区间：最近 ${data.days} 天` : "数据从页面访问与下载发生后开始累积"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="页面浏览 PV" value={data.totals.pv} hint="公开页面访问次数" tone="brand" />
        <MetricCard label="独立访客 UV" value={data.totals.uv} hint="按访客标识去重" />
        <MetricCard label="下载次数" value={data.totals.downloads} hint="安装包成功下载" />
        <MetricCard
          label="安装上报"
          value={data.totals.installs}
          hint={`首次 ${data.totals.newInstalls} · 更新 ${data.totals.updates}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section className="card-apple p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">访问与下载趋势</h2>
            <span className="text-[11px] text-neutral-400">每日 PV / 下载</span>
          </div>
          <div className="mt-4">
            <TrendChart series={data.series} />
          </div>
        </section>
        <InstallSplit overview={data} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <BreakdownCard title="流量渠道" items={data.channels} emptyText="暂无访问记录" />
        <BreakdownCard title="安装设备" items={data.devices} emptyText="暂无安装上报" />
        <BreakdownCard title="系统版本" items={data.systems} emptyText="暂无安装上报" />
      </div>

      <section className="card-apple overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">应用表现排行</h2>
          <span className="text-[11px] text-neutral-400">PV + 下载 + 安装</span>
        </div>
        {data.topApps.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">
            还没有统计数据，分享应用页面或安装包后会在这里累计
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-neutral-100 dark:border-neutral-800">
                  <th className="px-5 py-2 text-left font-medium">应用</th>
                  <th className="px-3 py-2 text-right font-medium">PV</th>
                  <th className="px-3 py-2 text-right font-medium">下载</th>
                  <th className="px-3 py-2 text-right font-medium">安装</th>
                </tr>
              </thead>
              <tbody>
                {data.topApps.map((app) => (
                  <tr key={app.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-5 py-2.5">
                      <Link href={`${appHrefBase}/${app.id}`} className="font-medium transition hover:text-brand">
                        {app.name}
                      </Link>
                      <span className="ml-2 text-xs text-neutral-400">/{app.slug}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{app.pv}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{app.downloads}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{app.installs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
