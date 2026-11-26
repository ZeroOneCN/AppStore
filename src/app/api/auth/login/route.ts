import { NextResponse } from "next/server";
import { z } from "zod";
import { originFromRequest } from "@/server/http/base-url";
import { clientKeyFrom } from "@/server/http/session";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { AppError, isAppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { login, sessionCookieOptions } from "@/server/services/auth.service";
import { developerLogin } from "@/server/services/developer-auth.service";

/** 统一登录请求体 */
const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

/** 登录成功后按角色进入的控制台首页 */
const HOME_BY_ROLE = {
  admin: "/admin/apps",
  developer: "/developer/apps",
} as const;

/**
 * 统一登录：先按管理员校验，再按开发者校验，成功后下发统一会话 Cookie。
 * @param request HTTP 请求，body 为 { username, password }
 * @returns 角色、用户名与跳转地址；失败时返回标准错误
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "请填写用户名与密码");
    }

    const clientKey = clientKeyFrom(request);
    const { username, password } = parsed.data;

    let role: "admin" | "developer";
    let token: string;
    let displayName: string | undefined;

    try {
      token = await login(username, password, clientKey);
      role = "admin";
      await logAudit(username, "admin.login", username, "管理员账号密码登录");
    } catch (error) {
      // 管理员校验未通过时才尝试开发者身份；限流等异常直接抛出
      if (!(isAppError(error) && error.code === "UNAUTHORIZED")) throw error;

      const result = await developerLogin(username, password, clientKey);
      token = result.token;
      role = "developer";
      displayName = result.developer.displayName || undefined;
      await logAudit(`dev:${username}`, "dev.login", username, "开发者账号密码登录");
    }

    const response = NextResponse.json(
      { role, username, displayName, redirectTo: HOME_BY_ROLE[role] },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(
      SESSION_COOKIE,
      token,
      sessionCookieOptions(originFromRequest(request).startsWith("https://")),
    );
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
