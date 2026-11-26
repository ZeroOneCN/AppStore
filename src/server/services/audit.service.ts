import { headers } from "next/headers";
import { prisma } from "../db";
import { logger } from "../infra/logger";

/** 审计日志条目 */
export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  createdAt: string;
}

/** 审计日志分页结果 */
export interface AuditLogPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 操作类型 → 中文名称 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "admin.login": "登录后台",
  "admin.password": "修改密码",
  "logs.clear": "清空日志",
  "settings.update": "更新站点设置",
  "settings.registration": "调整注册模式",
  "invite.create": "生成邀请码",
  "invite.delete": "删除邀请码",
  "dev.register": "开发者注册",
  "app.create": "创建应用",
  "app.update": "更新应用",
  "app.delete": "删除应用",
  "release.upload": "上传版本",
  "release.publish": "发布版本",
  "release.set-current": "切换当前版本",
  "release.archive": "归档版本",
  "release.delete": "删除版本",
  "developer.create": "创建开发者",
  "developer.status": "调整开发者状态",
  "developer.reset-password": "重置开发者密码",
  "dev.login": "开发者登录",
  "dev.password": "开发者修改密码",
  "dev.app.create": "开发者创建应用",
  "dev.app.update": "开发者更新应用",
  "dev.release.upload": "开发者上传版本",
  "dev.release.set-current": "开发者切换当前版本",
  "dev.release.archive": "开发者归档版本",
  "dev.release.delete": "开发者删除版本",
};

/**
 * 从当前请求头读取来源 IP，反向代理场景保留完整转发链。
 * 无请求上下文时返回空字符串。
 * @returns 客户端 IP 文本
 */
async function requestIp(): Promise<string> {
  try {
    const store = await headers();
    const forwarded = store.get("x-forwarded-for");
    if (forwarded) {
      const chain = forwarded
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .join(", ");
      if (chain) return chain.slice(0, 200);
    }
    const realIp = store.get("x-real-ip");
    if (realIp) return realIp.slice(0, 200);
    return "";
  } catch {
    return "";
  }
}

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
    await prisma.auditLog.create({
      data: { actor, action, target, detail, ip: await requestIp() },
    });
  } catch (error) {
    logger.error("写入审计日志失败", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * 分页查询审计日志。
 * @param page 页码，从 1 开始
 * @param pageSize 每页条数
 * @returns 分页结果（时间倒序）
 */
export async function listAuditLogs(page = 1, pageSize = 20): Promise<AuditLogPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(1, Math.floor(pageSize)));
  const total = await prisma.auditLog.count();
  const totalPages = Math.max(1, Math.ceil(total / safeSize));
  const current = Math.min(safePage, totalPages);

  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * safeSize,
    take: safeSize,
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      target: row.target,
      detail: row.detail,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page: current,
    pageSize: safeSize,
    totalPages,
  };
}

/**
 * 清空全部审计日志。
 * @returns 删除条数
 */
export async function clearAuditLogs(): Promise<number> {
  const result = await prisma.auditLog.deleteMany();
  return result.count;
}
