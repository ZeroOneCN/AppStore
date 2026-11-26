import { z } from "zod";
import { requireDeveloper } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { changeDeveloperPassword } from "@/server/services/developer.service";

/** 修改密码请求体 */
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

/**
 * 开发者修改自己的密码。
 * @param request HTTP 请求，body 含当前密码与新密码
 * @returns 成功标记
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireDeveloper();

    const body: unknown = await request.json().catch(() => null);
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写当前密码与至少 8 位的新密码");
    }

    await changeDeveloperPassword(session.sub, parsed.data.currentPassword, parsed.data.newPassword);
    await logAudit(`dev:${session.username}`, "dev.password", session.username, "修改开发者密码");

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
