import { requireAdmin } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { setCurrent } from "@/server/services/release.service";

/**
 * 将指定已发布版本设为当前版本（回滚）。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为版本 ID
 * @returns 更新后的版本记录
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const release = await setCurrent(id);
    return Response.json(release, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
