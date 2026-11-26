"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 后台导航项 */
export type ConsoleNavItem = {
  href: string;
  label: string;
  /** SVG path，用于侧边栏图标 */
  icon: string;
  /** 分组名称 */
  group: string;
};

/**
 * 计算当前应高亮的导航项：取匹配路径最长的一项，避免父级与子级同时选中。
 * @param pathname 当前路径
 * @param items 导航项
 * @returns 高亮项地址
 */
function resolveActiveHref(pathname: string, items: ConsoleNavItem[]): string {
  const matched = items
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return matched[0]?.href ?? "";
}

/**
 * 后台导航，支持侧边栏纵向与移动端横向两种形态。
 * @param props.items 导航项
 * @param props.orientation 排列方向
 * @returns 导航结构
 */
export function ConsoleNav({
  items,
  orientation = "vertical",
}: {
  items: ConsoleNavItem[];
  orientation?: "vertical" | "horizontal";
}) {
  const pathname = usePathname();
  const activeHref = resolveActiveHref(pathname, items);

  if (orientation === "horizontal") {
    return (
      <nav className="grid grid-cols-3 gap-1" aria-label="后台导航">
        {items.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center rounded-lg px-2 py-2 text-center text-[12px] whitespace-nowrap transition ${
                active
                  ? "bg-brand/10 font-medium text-brand"
                  : "text-neutral-600 hover:bg-black/[0.04] dark:text-neutral-300 dark:hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  const grouped = items.map((item, index) => ({
    item,
    showGroup: index === 0 || items[index - 1]?.group !== item.group,
  }));

  return (
    <nav className="space-y-1" aria-label="后台导航">
      {grouped.map(({ item, showGroup }) => {
        const active = item.href === activeHref;

        return (
          <div key={item.href}>
            {showGroup ? (
              <p className="px-3 pt-4 pb-1.5 text-[10px] font-medium tracking-[0.16em] text-neutral-400 uppercase">
                {item.group}
              </p>
            ) : null}
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition ${
                active
                  ? "bg-brand/10 font-medium text-brand"
                  : "text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={item.icon} />
              </svg>
              <span className="truncate">{item.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
