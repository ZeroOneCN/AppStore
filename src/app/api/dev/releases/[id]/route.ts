import { requireDeveloper } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { assertDeveloperRelease } from "@/server/services/developer.service";
import { deleteRelease } from "@/server/services/release.service";

/**
 * 开发者删除自己的历史版本（当前版本由业务层拒绝）。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为版本 ID
 * @returns 204 无内容
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireDeveloper();
    const { id } = await context.params;

    await assertDeveloperRelease(id, session.sub);
    const removed = await deleteRelease(id);
    await logAudit(
      `dev:${session.username}`,
      "dev.release.delete",
      `v${removed.versionName}`,
      `应用 ${removed.appId}`,
    );

    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
