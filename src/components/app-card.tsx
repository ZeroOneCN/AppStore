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
  if (iconUrl) {
    return (
      <Image
        src={iconUrl}
        alt={`${name} 图标`}
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-xl border border-neutral-200/70 bg-white object-cover dark:border-neutral-700"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
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
 * 应用卡片，用于应用墙网格。
 * @param props.app 应用卡片数据
 * @returns 卡片链接
 */
export function AppCard({ app }: { app: AppCardDto }) {
  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 transition hover:border-indigo-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500/60"
    >
      <div className="flex items-start gap-3">
        <AppIcon name={app.name} iconUrl={app.iconUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{app.name}</h3>
            {app.pinned ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                置顶
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-500 dark:text-neutral-400">
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
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
          {app.category}
        </span>
        {app.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <span className="truncate">
          {app.currentVersion
            ? `v${app.currentVersion.versionName}`
            : app.type === "WEB"
              ? "网页作品"
              : "尚未发布"}
        </span>
        <span className="shrink-0">{app.downloadCount} 次下载</span>
      </div>
    </Link>
  );
}
