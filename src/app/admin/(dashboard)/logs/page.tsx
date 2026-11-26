import { connection } from "next/server";
import { Suspense } from "react";
import { formatDateTime } from "@/lib/format";
import { AUDIT_ACTION_LABEL, listAuditLogs } from "@/server/services/audit.service";
import { requireAdminPage } from "@/server/http/guards";

/**
 * 审计日志数据区。
 * @returns 最近操作列表
 */
async function LogsContent() {
  await connection();
  await requireAdminPage();
  const logs = await listAuditLogs(100);

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">操作日志</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          最近 100 条后台操作记录，用于追溯变更
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="card-apple grid min-h-[260px] place-items-center px-6 text-center">
          <p className="text-base font-medium">还没有操作记录</p>
          <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            创建应用、上传版本或修改设置后会记录在这里
          </p>
        </div>
      ) : (
        <div className="card-apple overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs text-neutral-500 dark:text-neutral-400">
              <tr className="border-b border-neutral-100 dark:border-neutral-800">
                <th className="px-5 py-2.5 text-left font-medium">时间</th>
                <th className="px-3 py-2.5 text-left font-medium">操作者</th>
                <th className="px-3 py-2.5 text-left font-medium">操作</th>
                <th className="px-3 py-2.5 text-left font-medium">对象</th>
                <th className="px-5 py-2.5 text-left font-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                  <td className="whitespace-nowrap px-5 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">{log.actor}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                      {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{log.target || "—"}</td>
                  <td className="px-5 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {log.detail || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * 后台操作日志页。
 * @returns 页面内容
 */
export default function AdminLogsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full animate-pulse space-y-4">
          <div className="h-10 w-40 rounded-xl bg-black/[0.06] dark:bg-white/10" />
          <div className="h-72 rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
        </div>
      }
    >
      <LogsContent />
    </Suspense>
  );
}
