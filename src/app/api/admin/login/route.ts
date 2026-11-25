import { NextResponse } from "next/server";
import { z } from "zod";
import { clientKeyFrom } from "@/server/http/session";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { login, sessionCookieOptions } from "@/server/services/auth.service";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

/**
 * 管理员登录：校验账号密码并下发 HttpOnly 会话 Cookie。
 * @param request HTTP 请求，body 为 { username, password }
 * @returns 登录结果，失败时返回标准错误
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写用户名与密码");
    }

    const token = await login(parsed.data.username, parsed.data.password, clientKeyFrom(request));
    const response = NextResponse.json(
      { username: parsed.data.username },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
