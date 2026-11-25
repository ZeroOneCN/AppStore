"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 导航项 */
const NAV_ITEMS = [
  { href: "/admin/apps", label: "应用管理" },
  { href: "/admin/apps/new", label: "新建应用" },
];

/**
 * 后台顶部导航，按当前路径高亮。
 * @returns 导航链接
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin/apps" ? pathname === "/admin/apps" || pathname.startsWith("/admin/apps/") && pathname !== "/admin/apps/new" : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-full px-3 py-1.5 text-[13px] transition ${
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
