"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 导航项，exact 为 true 时只匹配完全相同的路径 */
const NAV_ITEMS = [
  { href: "/admin/apps", label: "应用管理", exact: false },
  { href: "/admin/apps/new", label: "新建应用", exact: true },
  { href: "/admin/developers", label: "开发者", exact: true },
  { href: "/admin/stats", label: "数据统计", exact: true },
  { href: "/admin/logs", label: "操作日志", exact: true },
  { href: "/admin/settings", label: "设置", exact: true },
];

/**
 * 判断导航项是否处于激活状态。
 * @param pathname 当前路径
 * @param item 导航项
 * @returns 激活返回 true
 */
function isActive(pathname: string, item: (typeof NAV_ITEMS)[number]): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * 后台顶部导航，按当前路径高亮。
 * @returns 导航链接
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto text-sm sm:gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-2.5 py-1.5 text-[13px] transition sm:px-3 ${
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
