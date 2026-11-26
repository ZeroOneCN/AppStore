"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 开发者导航项 */
const NAV_ITEMS = [
  { href: "/developer/apps", label: "我的应用", exact: false },
  { href: "/developer/apps/new", label: "新建应用", exact: true },
  { href: "/developer/settings", label: "账号设置", exact: true },
];

/**
 * 开发者门户导航。
 * @returns 导航链接
 */
export function DevNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition ${
              active
                ? "bg-black/[0.06] font-medium text-neutral-900 dark:bg-white/12 dark:text-white"
                : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
