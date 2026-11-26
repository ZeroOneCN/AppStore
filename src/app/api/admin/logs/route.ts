import { getSession } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { clearAuditLogs, logAudit } from "@/server/services/audit.service";

/**
 * 清空操作日志（仅管理员）。
 * @returns 删除条数与成功标记
 */
export async function DELETE(): Promise<Response> {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      throw new AppError("UNAUTHORIZED", "请先登录管理后台");
    }

    const removed = await clearAuditLogs();
    await logAudit(session.username, "logs.clear", "操作日志", `清空 ${removed} 条记录`);

    return Response.json({ ok: true, removed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
