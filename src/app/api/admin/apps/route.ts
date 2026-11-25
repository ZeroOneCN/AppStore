import { connection } from "next/server";
import { appCreateSchema } from "@/server/http/app-schema";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { createApp, listAdminApps } from "@/server/services/app.service";
import { logAudit } from "@/server/services/audit.service";

/**
 * 后台应用列表，包含草稿与私有应用。
 * @returns 全部应用卡片
 */
export async function GET(): Promise<Response> {
  await connection();
  try {
    await requireAdmin();
    const items = await listAdminApps();
    return Response.json({ total: items.length, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 创建应用。
 * @param request HTTP 请求，body 为应用字段
 * @returns 新建的应用记录
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();

    const body: unknown = await request.json().catch(() => null);
    const parsed = appCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "应用字段不合法", parsed.error.issues);
    }

    const app = await createApp(parsed.data);
    await logAudit(session.username, "app.create", app.name, `访问标识 /${app.slug}`);
    return Response.json(app, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
