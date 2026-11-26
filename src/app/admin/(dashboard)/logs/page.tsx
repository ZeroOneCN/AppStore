import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClearLogsButton } from "@/components/admin/clear-logs-button";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABEL, listAuditLogs } from "@/server/services/audit.service";
import { requireAdminPage } from "@/server/http/guards";

/** 日志页查询参数 */
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * 解析页码，非法值回退为 1。
 * @param params 查询参数
 * @returns 页码
 */
function readPage(params: Record<string, string | string[] | undefined>): number {
  const value = params.page;
  const raw = typeof value === "string" ? value : Array.isArray(value) ? value[0] : undefined;
  const page = Number(raw);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * 审计日志数据区：分页表格与清除操作。
 * @param props.searchParams 查询参数
 * @returns 日志页面
 */
async function LogsContent({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  await requireAdminPage();

  const params = await searchParams;
  const result = await listAuditLogs(readPage(params), 20);
  const { items: logs, total, page, totalPages } = result;

  return (
    <div className="w-full">
      <PageHeader
        title="操作日志"
        description={`共 ${total} 条记录，记录来源 IP 便于追溯${totalPages > 1 ? `，当前第 ${page} / ${totalPages} 页` : ""}`}
        actions={<ClearLogsButton />}
      />

      {logs.length === 0 ? (
        <EmptyState
          title="还没有操作记录"
          description="创建应用、上传版本或修改设置后会记录在这里"
          compact
        />
      ) : (
        <>
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="text-xs text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-black/[0.07] dark:border-white/10">
                  <th className="px-4 py-3 text-left font-medium">时间</th>
                  <th className="px-3 py-3 text-left font-medium">操作者</th>
                  <th className="px-3 py-3 text-left font-medium">操作</th>
                  <th className="px-3 py-3 text-left font-medium">对象</th>
                  <th className="px-3 py-3 text-left font-medium">来源 IP</th>
                  <th className="px-4 py-3 text-left font-medium">说明</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-black/[0.05] last:border-0 dark:border-white/[0.08]"
                  >
                    <td className="px-4 py-3 text-xs whitespace-nowrap text-neutral-500 dark:text-neutral-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{log.actor}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-brand">
                        {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{log.target || "—"}</td>
                    <td className="max-w-[240px] px-3 py-3 font-mono text-[11px] break-all text-neutral-500 dark:text-neutral-400">
                      {log.ip || "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                      {log.detail || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="mt-4 flex items-center justify-between gap-3 text-xs" aria-label="日志分页">
            <span className="text-neutral-500 dark:text-neutral-400">
              第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link href={`/admin/logs?page=${page - 1}`} className="btn-secondary min-h-9 px-4 py-2 text-xs">
                  上一页
                </Link>
              ) : (
                <span className="btn-secondary min-h-9 cursor-not-allowed px-4 py-2 text-xs opacity-50">
                  上一页
                </span>
              )}
              {page < totalPages ? (
                <Link href={`/admin/logs?page=${page + 1}`} className="btn-secondary min-h-9 px-4 py-2 text-xs">
                  下一页
                </Link>
              ) : (
                <span className="btn-secondary min-h-9 cursor-not-allowed px-4 py-2 text-xs opacity-50">
                  下一页
                </span>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

/**
 * 后台操作日志页。
 * @param props.searchParams 查询参数
 * @returns 页面内容
 */
export default function AdminLogsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-48 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          <div className="h-72 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      }
    >
      <LogsContent searchParams={searchParams} />
    </Suspense>
  );
}
