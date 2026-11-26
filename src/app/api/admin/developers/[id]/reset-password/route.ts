import { randomInt } from "node:crypto";
import { requireAdmin } from "@/server/http/session";
import { toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { resetDeveloperPassword } from "@/server/services/developer.service";

/** 一次性密码字符集（去掉易混淆字符） */
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * 生成随机初始密码。
 * @param length 密码长度
 * @returns 随机密码
 */
function generatePassword(length = 12): string {
  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_CHARS[randomInt(0, PASSWORD_CHARS.length)];
  }
  return password;
}

/**
 * 管理员重置开发者密码，明文仅在本次响应返回一次。
 * @param _request HTTP 请求
 * @param context 路由参数，id 为开发者 ID
 * @returns 一次性新密码
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;

    const password = generatePassword();
    await resetDeveloperPassword(id, password);
    // 审计不记录明文密码
    await logAudit(session.username, "developer.reset-password", id, "生成一次性密码");

    return Response.json(
      { password },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
