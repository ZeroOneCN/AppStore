import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import type { ChangelogTag } from "@/lib/changelog";
import { CHANGELOG, CHANGELOG_TOTAL } from "@/lib/changelog";
import { requireAdminPage } from "@/server/http/guards";

/** 分类标签样式 */
const TAG_STYLE: Record<ChangelogTag, string> = {
  上线: "bg-brand/10 text-brand dark:bg-brand/20",
  功能: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  优化: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  修复: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  安全: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  客户端: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  数据: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
};

/**
 * 更新日志内容区。
 * @returns 更新日志页面
 */
async function ChangelogContent() {
  await connection();
  await requireAdminPage();

  return (
    <div className="w-full">
      <PageHeader title="更新日志" description="从项目上线到现在的功能、优化与修复记录" />

      <div className="card-apple mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-medium">应用仓库持续更新中</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            上线于 2026-11-25，已记录 {CHANGELOG_TOTAL} 项更新
          </p>
        </div>
        <span className="chip">最新：{CHANGELOG[0]?.date}</span>
      </div>

      <div className="space-y-8">
        {CHANGELOG.map((day, dayIndex) => (
          <section key={day.date} className="sm:grid sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
            <div className="sm:sticky sm:top-24 sm:self-start">
              <p className="text-sm font-semibold tabular-nums">{day.date}</p>
              <p className="mt-0.5 text-[11px] text-neutral-400">{day.entries.length} 项更新</p>
              {dayIndex === 0 ? (
                <span className="mt-2 inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-medium text-brand dark:bg-brand/20">
                  最新
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-3 sm:mt-0">
              {day.entries.map((entry) => (
                <article
                  key={`${day.date}-${entry.title}`}
                  className="card-apple p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TAG_STYLE[entry.tag]}`}
                    >
                      {entry.tag}
                    </span>
                    <h2 className="text-sm font-semibold">{entry.title}</h2>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-[13px] leading-6 text-neutral-600 dark:text-neutral-300">
                    {entry.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * 后台更新日志页。
 * @returns 页面内容
 */
export default function AdminChangelogPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          <div className="h-16 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
          ))}
        </div>
      }
    >
      <ChangelogContent />
    </Suspense>
  );
}
