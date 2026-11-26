import { z } from "zod";
import { getSession, requireDeveloper } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { changePassword } from "@/server/services/auth.service";
import { changeDeveloperPassword } from "@/server/services/developer.service";

/** 修改密码请求体 */
const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

/**
 * 修改当前登录账号的密码，按会话角色分别处理管理员与开发者。
 * @param request HTTP 请求，body 含当前密码与新密码
 * @returns 成功标记
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) throw new AppError("UNAUTHORIZED", "请先登录");

    const body: unknown = await request.json().catch(() => null);
    const parsed = passwordSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写当前密码与至少 8 位的新密码");
    }

    if (session.role === "admin") {
      await changePassword(session.username, parsed.data.currentPassword, parsed.data.newPassword);
      await logAudit(session.username, "admin.password", session.username, "修改管理员密码");
    } else {
      // 重新校验开发者会话，确保停用账号无法改密
      const developer = await requireDeveloper();
      await changeDeveloperPassword(
        developer.sub,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
      await logAudit(`dev:${developer.username}`, "dev.password", developer.username, "修改开发者密码");
    }

    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
