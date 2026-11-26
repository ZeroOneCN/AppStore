import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DevelopersManager } from "@/components/admin/developers-manager";
import { listDevelopers } from "@/server/services/developer.service";
import { requireAdminPage } from "@/server/http/guards";

/**
 * 开发者管理数据区。
 * @returns 开发者列表与新建表单
 */
async function DevelopersContent() {
  await connection();
  await requireAdminPage();
  const developers = await listDevelopers();

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">开发者</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            创建开发者账号、启停权限与重置密码；开发者从 /developer 登录管理自己的应用
          </p>
        </div>
        <Link
          href="/developer/login"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary"
        >
          打开开发者登录
        </Link>
      </div>

      <DevelopersManager developers={developers} />
    </div>
  );
}

/**
 * 开发者管理页。
 * @returns 页面内容
 */
export default function AdminDevelopersPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-8 w-40 rounded-lg bg-black/[0.06] dark:bg-white/10" />
          <div className="h-40 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
          <div className="h-64 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      }
    >
      <DevelopersContent />
    </Suspense>
  );
}
