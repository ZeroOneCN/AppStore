import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { DevelopersManager } from "@/components/admin/developers-manager";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        title="开发者"
        description="创建开发者账号、启停权限与重置密码；开发者从统一登录入口进入自己的控制台"
        actions={
          <Link href="/login" target="_blank" rel="noreferrer" className="btn-secondary">
            打开统一登录页
          </Link>
        }
      />

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
