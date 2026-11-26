import { randomInt } from "node:crypto";
import type { InviteCode } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../infra/errors";

/** 邀请码状态 */
export type InviteCodeStatus = "AVAILABLE" | "USED" | "EXPIRED";

/** 邀请码条目 */
export interface InviteCodeItem {
  id: string;
  code: string;
  note: string;
  status: InviteCodeStatus;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  usedBy: string | null;
}

/** 生成邀请码使用的字符集，去除易混淆的 0/O/1/I */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * 生成形如 APP-XXXX-XXXX 的随机邀请码。
 * @returns 邀请码字符串
 */
function generateCode(): string {
  const block = () =>
    Array.from({ length: 4 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `APP-${block()}-${block()}`;
}

/**
 * 规范化用户输入的邀请码：去空格、转大写。
 * @param code 原始输入
 * @returns 标准格式邀请码
 */
export function normalizeInviteCode(code: string): string {
  return code.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * 计算邀请码当前状态。
 * @param row 邀请码记录
 * @param now 当前时间
 * @returns 可用 / 已使用 / 已过期
 */
function statusOf(
  row: { usedAt: Date | null; expiresAt: Date | null },
  now = new Date(),
): InviteCodeStatus {
  if (row.usedAt) return "USED";
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "AVAILABLE";
}

/**
 * 查询邀请码列表（创建时间倒序）。
 * @param limit 最多返回条数
 * @returns 邀请码条目
 */
export async function listInviteCodes(limit = 200): Promise<InviteCodeItem[]> {
  const rows = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const now = new Date();
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    note: row.note,
    status: statusOf(row, now),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    usedAt: row.usedAt?.toISOString() ?? null,
    usedBy: row.usedBy,
  }));
}

/**
 * 批量生成邀请码。
 * @param input 数量、备注、过期时间与创建者
 * @returns 新创建的邀请码条目
 * @throws AppError 数量不合法时抛出 VALIDATION_FAILED
 */
export async function createInviteCodes(input: {
  count: number;
  note?: string;
  expiresAt?: Date | null;
  createdBy: string;
}): Promise<InviteCodeItem[]> {
  const count = input.count;
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new AppError("VALIDATION_FAILED", "单次最多生成 20 个邀请码");
  }

  const created: InviteCodeItem[] = [];
  for (let index = 0; index < count; index += 1) {
    let saved: InviteCode | null = null;
    // 极小概率撞码，最多重试 5 次
    for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
      try {
        saved = await prisma.inviteCode.create({
          data: {
            code: generateCode(),
            note: input.note?.trim() ?? "",
            expiresAt: input.expiresAt ?? null,
            createdBy: input.createdBy,
          },
        });
      } catch {
        saved = null;
      }
    }
    if (!saved) throw new AppError("INTERNAL_ERROR", "邀请码生成失败，请重试");
    created.push({
      id: saved.id,
      code: saved.code,
      note: saved.note,
      status: statusOf(saved),
      createdAt: saved.createdAt.toISOString(),
      expiresAt: saved.expiresAt?.toISOString() ?? null,
      usedAt: null,
      usedBy: null,
    });
  }
  return created;
}

/**
 * 删除邀请码记录。
 * @param id 邀请码 ID
 * @returns 无
 * @throws AppError 记录不存在时抛出 NOT_FOUND
 */
export async function deleteInviteCode(id: string): Promise<void> {
  const result = await prisma.inviteCode.deleteMany({ where: { id } });
  if (result.count === 0) throw new AppError("NOT_FOUND", "邀请码不存在");
}

/**
 * 统计各状态邀请码数量，供后台概览。
 * @returns 总数与可用数量
 */
export async function countInviteCodes(): Promise<{ total: number; available: number }> {
  const now = new Date();
  const [total, available] = await Promise.all([
    prisma.inviteCode.count(),
    prisma.inviteCode.count({
      where: {
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
  ]);
  return { total, available };
}
