import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ConsoleShell } from "@/components/console/console-shell";
import type { ConsoleNavItem } from "@/components/console/console-nav";
import { requireDeveloper } from "@/server/http/session";

/** 开发者导航配置 */
const NAV_ITEMS: ConsoleNavItem[] = [
  {
    href: "/developer/apps",
    label: "我的应用",
    group: "应用",
    icon: "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
  },
  {
    href: "/developer/apps/new",
    label: "新建应用",
    group: "应用",
    icon: "M4 5h16v14H4V5Zm8 3v8m-4-4h8",
  },
  {
    href: "/docs",
    label: "接入文档",
    group: "资源",
    icon: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm4 4h7M9 12h7",
  },
  {
    href: "/developer/settings",
    label: "账号设置",
    group: "资源",
    icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21a7 7 0 0 1 14 0",
  },
];

/**
 * 开发者门户外壳：校验开发者会话并渲染统一控制台布局。
 * @param props.children 页面内容
 * @returns 门户布局
 */
async function DeveloperShell({ children }: { children: React.ReactNode }) {
  await connection();

  let username = "";
  try {
    username = (await requireDeveloper()).username;
  } catch {
    redirect("/login?next=%2Fdeveloper%2Fapps");
  }

  return (
    <ConsoleShell
      consoleName="开发者门户"
      items={NAV_ITEMS}
      username={username}
      roleLabel="开发者"
    >
      {children}
    </ConsoleShell>
  );
}

/**
 * 开发者门户布局，会话校验期间展示占位。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function DeveloperLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center text-sm text-neutral-500 dark:text-neutral-400">
          正在校验登录状态…
        </div>
      }
    >
      <DeveloperShell>{children}</DeveloperShell>
    </Suspense>
  );
}
