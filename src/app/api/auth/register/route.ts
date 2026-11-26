import { NextResponse } from "next/server";
import { z } from "zod";
import { originFromRequest } from "@/server/http/base-url";
import { clientKeyFrom } from "@/server/http/session";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { sessionCookieOptions } from "@/server/services/auth.service";
import { createDeveloperSessionToken } from "@/server/services/developer-auth.service";
import { registerDeveloper } from "@/server/services/registration.service";

/** 开发者注册请求体 */
const registerSchema = z.object({
  username: z.string().trim().min(3).max(32),
  displayName: z.string().trim().max(40).optional(),
  password: z.string().min(8).max(64),
  inviteCode: z.string().trim().max(40).optional(),
});

/**
 * 开发者注册：注册模式与邀请码均以数据库后台设置为准。
 * @param request HTTP 请求，body 为 { username, displayName?, password, inviteCode? }
 * @returns 注册成功后的角色与跳转地址，并下发统一会话 Cookie
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "请填写完整的注册信息",
      );
    }

    const developer = await registerDeveloper(parsed.data, clientKeyFrom(request));
    const token = await createDeveloperSessionToken({
      id: developer.id,
      username: developer.username,
    });
    await logAudit(`dev:${developer.username}`, "dev.register", developer.username, "开发者自助注册");

    const response = NextResponse.json(
      {
        role: "developer",
        username: developer.username,
        displayName: developer.displayName || undefined,
        redirectTo: "/developer/apps",
      },
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
