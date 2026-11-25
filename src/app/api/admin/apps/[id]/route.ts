import { appUpdateSchema } from "@/server/http/app-schema";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { deleteApp, updateApp } from "@/server/services/app.service";

/**
 * 更新应用基本信息、可见性与置顶。
 * @param request HTTP 请求，body 为可选字段
 * @param context 路由参数
 * @returns 更新后的应用记录
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const body: unknown = await request.json().catch(() => null);
    const parsed = appUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "应用字段不合法", parsed.error.issues);
    }

    const app = await updateApp(id, parsed.data);
    return Response.json(app, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 删除应用及其版本记录与磁盘文件。
 * @param _request HTTP 请求
 * @param context 路由参数
 * @returns 204 无内容
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await deleteApp(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
