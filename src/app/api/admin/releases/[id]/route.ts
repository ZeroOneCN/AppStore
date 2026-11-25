import { requireAdmin } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { deleteRelease } from "@/server/services/release.service";

/**
 * 删除历史版本，当前版本不允许删除。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为版本 ID
 * @returns 无内容
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const removed = await deleteRelease(id);
    await logAudit(session.username, "release.delete", `v${removed.versionName}`, `版本 ID ${id}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
