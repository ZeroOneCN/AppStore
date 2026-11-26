import { requireAdmin } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { deleteInviteCode, listInviteCodes } from "@/server/services/invite-code.service";

/**
 * 删除邀请码（仅管理员）。
 * @param _request HTTP 请求
 * @param context 路由参数，包含邀请码 ID
 * @returns 删除结果
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const items = await listInviteCodes(1000);
    const target = items.find((item) => item.id === id);
    await deleteInviteCode(id);
    await logAudit(session.username, "invite.delete", target?.code ?? id, "删除邀请码");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
