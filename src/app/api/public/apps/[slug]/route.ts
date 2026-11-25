import { toErrorResponse } from "@/server/infra/errors";
import { getAppBySlug } from "@/server/services/app.service";

/**
 * 应用详情接口。
 * @param _request HTTP 请求
 * @param context 路由参数，slug 为 Promise（Next 16 约定）
 * @returns 应用详情
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const app = await getAppBySlug(slug);
    return Response.json(app, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
