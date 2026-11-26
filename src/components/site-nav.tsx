"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 前台导航项 */
const NAV_ITEMS = [
  { href: "/", label: "首页", exact: true },
  { href: "/apps", label: "应用", exact: false },
  { href: "/docs", label: "接入文档", exact: false },
];

/**
 * 前台主导航，按当前路径高亮。
 * @returns 导航链接
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-[13px]" aria-label="主导航">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1.5 whitespace-nowrap transition ${
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
