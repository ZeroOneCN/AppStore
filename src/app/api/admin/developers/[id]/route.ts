import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { getDeveloperById, setDeveloperStatus } from "@/server/services/developer.service";

/** 更新开发者请求体 */
const updateSchema = z.object({
  status: z.enum(["ACTIVE", "DISABLED"]),
});

/**
 * 启用或停用开发者账号。
 * @param request HTTP 请求，body 为 { status }
 * @param context 路由参数，id 为开发者 ID
 * @returns 更新后的状态
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;

    const body: unknown = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "状态仅支持 ACTIVE 或 DISABLED", parsed.error.issues);
    }

    const developer = await setDeveloperStatus(id, parsed.data.status);
    await logAudit(
      session.username,
      "developer.status",
      developer.username,
      developer.status === "ACTIVE" ? "启用账号" : "停用账号",
    );

    return Response.json(
      { id: developer.id, username: developer.username, status: developer.status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 查询开发者详情（供重置密码前确认）。
 * @param _request HTTP 请求
 * @param context 路由参数
 * @returns 开发者基本信息
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;
    const developer = await getDeveloperById(id);
    return Response.json(
      {
        id: developer.id,
        username: developer.username,
        displayName: developer.displayName,
        status: developer.status,
        createdAt: developer.createdAt.toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
