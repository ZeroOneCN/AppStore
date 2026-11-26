import { connection } from "next/server";
import { devAppCreateSchema } from "@/server/http/dev-app-schema";
import { requireDeveloper } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { createDeveloperApp, listDeveloperApps } from "@/server/services/developer.service";

/**
 * 当前开发者名下的应用列表。
 * @returns 应用卡片数组
 */
export async function GET(): Promise<Response> {
  await connection();
  try {
    const session = await requireDeveloper();
    const items = await listDeveloperApps(session.sub);
    return Response.json(
      { total: items.length, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 开发者创建自己的应用。
 * @param request HTTP 请求，body 为应用字段
 * @returns 新建的应用记录
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireDeveloper();

    const body: unknown = await request.json().catch(() => null);
    const parsed = devAppCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "应用字段不合法", parsed.error.issues);
    }

    const app = await createDeveloperApp(session.sub, parsed.data);
    await logAudit(
      `dev:${session.username}`,
      "dev.app.create",
      app.name,
      `访问标识 /${app.slug}`,
    );
    return Response.json(app, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
