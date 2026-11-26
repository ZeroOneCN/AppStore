import { devAppUpdateSchema } from "@/server/http/dev-app-schema";
import { requireDeveloperApp } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { updateDeveloperApp } from "@/server/services/developer.service";
import { listAllReleases } from "@/server/services/release.service";

/** 动态路由参数 */
type RouteParams = Promise<{ id: string }>;

/**
 * 查询当前开发者某个应用的详情与全部版本。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为应用 ID
 * @returns 应用与版本列表
 */
export async function GET(
  _request: Request,
  context: { params: RouteParams },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const { app } = await requireDeveloperApp(id);
    const releases = await listAllReleases(app.id);
    return Response.json(
      { app, releases },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 开发者更新自己的应用资料。
 * @param request HTTP 请求，body 为可选字段
 * @param context 路由参数，id 为应用 ID
 * @returns 更新后的应用记录
 */
export async function PUT(
  request: Request,
  context: { params: RouteParams },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const { session } = await requireDeveloperApp(id);

    const body: unknown = await request.json().catch(() => null);
    const parsed = devAppUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "应用字段不合法", parsed.error.issues);
    }

    const app = await updateDeveloperApp(session.sub, id, parsed.data);
    await logAudit(
      `dev:${session.username}`,
      "dev.app.update",
      app.name,
      `字段：${Object.keys(parsed.data).join("、") || "无"}`,
    );
    return Response.json(app, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
