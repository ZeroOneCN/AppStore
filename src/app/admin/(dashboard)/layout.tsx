import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConsoleShell } from "@/components/console/console-shell";
import type { ConsoleNavItem } from "@/components/console/console-nav";
import { requireAdmin } from "@/server/http/session";

/** 管理员导航配置 */
const NAV_ITEMS: ConsoleNavItem[] = [
  {
    href: "/admin/apps",
    label: "应用管理",
    group: "应用",
    icon: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  },
  {
    href: "/admin/apps/new",
    label: "新建应用",
    group: "应用",
    icon: "M4 5h16v14H4V5Zm8 3v8m-4-4h8",
  },
  {
    href: "/admin/developers",
    label: "开发者",
    group: "应用",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0",
  },
  {
    href: "/admin/stats",
    label: "数据统计",
    group: "系统",
    icon: "M5 20V10m5 10V4m5 16v-7m5 7V8",
  },
  {
    href: "/admin/logs",
    label: "操作日志",
    group: "系统",
    icon: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  },
  {
    href: "/admin/settings",
    label: "设置",
    group: "系统",
    icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M19 5l-2 2M7 17l-2 2",
  },
];

/**
 * 后台外壳：校验管理员会话并渲染统一控制台布局。
 * @param props.children 页面内容
 * @returns 后台布局
 */
async function AdminShell({ children }: { children: React.ReactNode }) {
  await connection();

  let username = "";
  try {
    username = (await requireAdmin()).username;
  } catch {
    redirect("/login?next=%2Fadmin%2Fapps");
  }

  return (
    <ConsoleShell
      consoleName="管理后台"
      items={NAV_ITEMS}
      username={username}
      roleLabel="管理员"
    >
      {children}
    </ConsoleShell>
  );
}

/**
 * 后台布局，会话校验期间展示占位。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-neutral-500 dark:text-neutral-400">
          正在校验登录状态…
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
