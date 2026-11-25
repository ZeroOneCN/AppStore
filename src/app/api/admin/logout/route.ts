import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/server/infra/constants";
import { sessionCookieOptions } from "@/server/services/auth.service";

/**
 * 管理员登出：清除会话 Cookie。
 * @returns 成功标记
 */
export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
