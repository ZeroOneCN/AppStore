import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKeyFrom } from "@/server/http/session";
import { DEVELOPER_SESSION_COOKIE } from "@/server/infra/constants";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { developerCookieOptions, developerLogin } from "@/server/services/developer-auth.service";

/** 登录请求体 */
const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

/**
 * 开发者登录：校验账号密码并下发独立的会话 Cookie。
 * @param request HTTP 请求，body 为 { username, password }
 * @returns 登录结果
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写用户名与密码");
    }

    const { token, developer } = await developerLogin(
      parsed.data.username,
      parsed.data.password,
      clientKeyFrom(request),
    );
    await logAudit(
      `dev:${developer.username}`,
      "dev.login",
      developer.username,
      `来源 ${clientKeyFrom(request)}`,
    );

    const response = NextResponse.json(
      { username: developer.username, displayName: developer.displayName },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(DEVELOPER_SESSION_COOKIE, token, developerCookieOptions());
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
