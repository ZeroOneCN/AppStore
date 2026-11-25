import { prisma } from "../db";
import { logger } from "../infra/logger";

/** 审计日志条目 */
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
}

/** 操作类型 → 中文名称 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "admin.login": "登录后台",
  "admin.password": "修改密码",
  "app.create": "创建应用",
  "app.update": "更新应用",
  "app.delete": "删除应用",
  "release.upload": "上传版本",
  "release.publish": "发布版本",
  "release.set-current": "切换当前版本",
  "release.archive": "归档版本",
  "release.delete": "删除版本",
};

/**
 * 写入一条审计日志；失败只记录日志，不影响主流程。
 * @param actor 操作者用户名
 * @param action 操作类型
 * @param target 操作对象
 * @param detail 补充说明
 * @returns 无
 */
export async function logAudit(
  actor: string,
  action: string,
  target = "",
  detail = "",
): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { actor, action, target, detail } });
  } catch (error) {
    logger.error("写入审计日志失败", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 查询最近的审计日志。
 * @param limit 返回条数，默认 100
 * @returns 审计日志数组（时间倒序）
 */
export async function listAuditLogs(limit = 100): Promise<AuditEntry[]> {
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    actor: row.actor,
    action: row.action,
    target: row.target,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  }));
}
