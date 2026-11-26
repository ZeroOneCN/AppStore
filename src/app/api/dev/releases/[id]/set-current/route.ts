import { requireDeveloper } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { assertDeveloperRelease } from "@/server/services/developer.service";
import { setCurrent } from "@/server/services/release.service";

/**
 * 开发者把自己已发布的某个版本切换为当前版本（回滚）。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为版本 ID
 * @returns 更新后的版本
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireDeveloper();
    const { id } = await context.params;

    await assertDeveloperRelease(id, session.sub);
    const release = await setCurrent(id);
    await logAudit(
      `dev:${session.username}`,
      "dev.release.set-current",
      `v${release.versionName}`,
      `应用 ${release.appId}`,
    );

    return Response.json(release, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
