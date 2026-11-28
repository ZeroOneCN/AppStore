import Image from "next/image";
import Link from "next/link";
import type { AppCardDto } from "@/server/services/app.service";

/**
 * 应用图标，无图标时展示名称首字占位。
 * @param props.name 应用名称，用于占位与替代文本
 * @param props.iconUrl 图标地址
 * @param props.size 图标像素尺寸
 * @returns 图标元素
 */
export function AppIcon({
  name,
  iconUrl,
  size = 56,
}: {
  name: string;
  iconUrl: string | null;
  size?: number;
}) {
  const radius = Math.round(size * 0.24);

  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt={`${name} 图标`}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 border border-black/[0.06] bg-white object-cover dark:border-white/10"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center bg-gradient-to-br from-brand to-[#5b83ff] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(30,81,238,0.9)]"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4), borderRadius: radius }}
    >
      {name.trim().charAt(0).toUpperCase() || "A"}
    </span>
  );
}

/** 应用类型徽标文案 */
const TYPE_LABEL: Record<AppCardDto["type"], string> = {
  ANDROID: "Android",
  WEB: "网页",
};

/**
 * 将版本发布时间格式化为月/日。
 * @param value ISO 时间字符串
 * @returns 形如 11/27 的短日期
 */
function formatShortDate(value: string): string {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 应用卡片，用于应用墙网格。
 * @param props.app 应用卡片数据
 * @param props.showReleaseDate 是否展示版本发布时间，首页用于说明排序依据
 * @returns 卡片链接
 */
export function AppCard({ app, showReleaseDate = false }: { app: AppCardDto; showReleaseDate?: boolean }) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group flex h-full flex-col gap-3 rounded-[22px] border border-black/[0.06] bg-white/85 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_18px_40px_-28px_rgba(30,81,238,0.65)] dark:border-white/10 dark:bg-[#1c1c1e]/85 dark:hover:border-brand/40"
    >
      <div className="flex items-start gap-3">
        <AppIcon name={app.name} iconUrl={app.iconUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{app.name}</h3>
            {app.pinned ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                置顶
              </span>
            ) : null}
          </div>
          {/* 作者信息：头像 + 名称，官方应用使用盾牌标识，保持一行占位以对齐卡片 */}
          <div className="mt-1 flex min-h-[18px] items-center gap-1.5 text-[11px]">
            {app.developer ? (
              <>
                <span
                  aria-hidden
                  className="grid size-4 shrink-0 place-items-center rounded-full bg-neutral-100 text-[9px] font-semibold text-neutral-600 dark:bg-white/10 dark:text-neutral-300"
                >
                  {(app.developer.displayName || app.developer.username).trim().charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-neutral-500 dark:text-neutral-400">
                  {app.developer.displayName || app.developer.username}
                </span>
              </>
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5 shrink-0 text-brand"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span className="truncate text-brand">平台官方</span>
              </>
            )}
          </div>
          {/* 固定预留两行简介高度，保证不同卡片下方的标签与底栏对齐 */}
          <p className="mt-1 line-clamp-2 min-h-[40px] text-[13px] leading-5 text-neutral-500 dark:text-neutral-400">
            {app.summary}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            app.type === "ANDROID"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          }`}
        >
          {TYPE_LABEL[app.type]}
        </span>
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[0.08] dark:text-neutral-300">
          {app.category}
        </span>
        {app.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-400"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3 text-[11px] text-neutral-500 dark:border-white/[0.08] dark:text-neutral-400">
        <span className="truncate tabular-nums">
          {app.currentVersion
            ? `v${app.currentVersion.versionName}${
                showReleaseDate ? ` · ${formatShortDate(app.currentVersion.publishedAt)} 发布` : ""
              }`
            : app.type === "WEB"
              ? "网页作品"
              : "尚未发布"}
        </span>
        <span className="shrink-0">{app.downloadCount} 次下载</span>
      </div>
    </Link>
  );
}
