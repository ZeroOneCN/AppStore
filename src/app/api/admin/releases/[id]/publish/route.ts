import { requireAdmin } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { publish } from "@/server/services/release.service";

/**
 * 发布版本并设为当前版本。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为版本 ID
 * @returns 发布后的版本记录
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const release = await publish(id);
    return Response.json(release, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
