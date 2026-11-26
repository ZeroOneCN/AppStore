import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { createDeveloper, listDevelopers } from "@/server/services/developer.service";

/** 创建开发者请求体 */
const createSchema = z.object({
  username: z.string().trim().min(3).max(32),
  displayName: z.string().trim().max(40).optional(),
  password: z.string().min(8).max(64),
});

/**
 * 开发者列表，附带应用数量。
 * @returns 开发者数组
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const items = await listDevelopers();
    return Response.json(
      { total: items.length, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 创建开发者账号。
 * @param request HTTP 请求，body 为 { username, displayName?, password }
 * @returns 新建的开发者（不含密码哈希）
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写 3-32 位用户名与至少 8 位密码", parsed.error.issues);
    }

    const developer = await createDeveloper(parsed.data);
    await logAudit(
      session.username,
      "developer.create",
      developer.username,
      developer.displayName ? `显示名 ${developer.displayName}` : "未设置显示名",
    );

    return Response.json(
      {
        id: developer.id,
        username: developer.username,
        displayName: developer.displayName,
        status: developer.status,
        createdAt: developer.createdAt.toISOString(),
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
