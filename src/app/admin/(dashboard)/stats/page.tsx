import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAdminStats } from "@/server/services/app.service";
import { requireAdminPage } from "@/server/http/guards";

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
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>
    </div>
  );
}

/**
 * 统计页数据区。
 * @returns 概览与下载排行
 */
async function StatsContent() {
  await connection();
  await requireAdminPage();
  const stats = await getAdminStats();

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">数据统计</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          应用、版本与下载量的整体概览
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricCard label="应用总数" value={stats.appTotal} hint={`Android ${stats.androidCount} · 网页 ${stats.webCount}`} />
        <MetricCard label="已发布应用" value={stats.publishedCount} hint="至少有一个正式版本" />
        <MetricCard label="版本总数" value={stats.releaseTotal} hint="包含草稿与已归档" />
        <MetricCard label="累计下载" value={stats.totalDownloads} hint="按成功响应计数" />
        <MetricCard label="Android 应用" value={stats.androidCount} hint="通过 APK 分发" />
        <MetricCard label="网页作品" value={stats.webCount} hint="跳转外部链接" />
      </div>

      <section className="card-apple mt-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
          <h2 className="text-sm font-semibold">下载排行</h2>
          <Link href="/admin/apps?sort=downloads" className="text-xs text-brand transition hover:text-brand-deep">
            查看全部
          </Link>
        </div>
        {stats.topApps.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">
            还没有下载记录，发布版本并分享给设备后会在这里累计
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-neutral-500 dark:text-neutral-400">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-5 py-2 text-left font-medium">应用</th>
                <th className="px-3 py-2 text-left font-medium">类型</th>
                <th className="px-5 py-2 text-right font-medium">下载次数</th>
              </tr>
            </thead>
            <tbody>
              {stats.topApps.map((app) => (
                <tr key={app.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                  <td className="px-5 py-2.5">
                    <Link href={`/admin/apps/${app.id}`} className="font-medium transition hover:text-brand">
                      {app.name}
                    </Link>
                    <span className="ml-2 text-xs text-neutral-400">/{app.slug}</span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {app.type === "ANDROID" ? "Android" : "网页"}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{app.downloadCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/**
 * 后台统计页。
 * @returns 页面内容
 */
export default function AdminStatsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[104px] rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
            ))}
          </div>
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}
