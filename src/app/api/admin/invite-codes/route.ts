import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import {
  countInviteCodes,
  createInviteCodes,
  listInviteCodes,
} from "@/server/services/invite-code.service";
import { getSiteSettings } from "@/server/services/settings.service";

/** 生成邀请码请求体 */
const createSchema = z.object({
  count: z.number().int().min(1).max(20).optional(),
  note: z.string().trim().max(60).optional(),
  expiresInDays: z.number().int().min(0).max(365).optional(),
});

/**
 * 邀请码列表与概览（仅管理员）。
 * @returns 注册模式、邀请码条目与统计
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const [{ registrationMode }, items, stats] = await Promise.all([
      getSiteSettings(),
      listInviteCodes(),
      countInviteCodes(),
    ]);
    return Response.json(
      { mode: registrationMode, stats, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 批量生成邀请码（仅管理员）。
 * @param request HTTP 请求，body 为 { count?, note?, expiresInDays? }
 * @returns 新生成的邀请码
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "邀请码参数不合法");
    }

    const count = parsed.data.count ?? 1;
    const days = parsed.data.expiresInDays ?? 0;
    const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const items = await createInviteCodes({
      count,
      note: parsed.data.note,
      expiresAt,
      createdBy: session.username,
    });
    await logAudit(
      session.username,
      "invite.create",
      `${count} 个邀请码`,
      parsed.data.note ? `备注：${parsed.data.note}` : "未填写备注",
    );

    return Response.json(
      { items, stats: await countInviteCodes() },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
