import { NextResponse } from "next/server";
import { DEVELOPER_SESSION_COOKIE } from "@/server/infra/constants";
import { developerCookieOptions } from "@/server/services/developer-auth.service";

/**
 * 开发者登出：仅清除开发者门户会话，不影响管理员会话。
 * @returns 成功标记
 */
export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(DEVELOPER_SESSION_COOKIE, "", { ...developerCookieOptions(), maxAge: 0 });
  return response;
}
