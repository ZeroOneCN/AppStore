import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { REGISTRATION_MODES } from "@/server/infra/constants";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { getSiteSettings, updateRegistrationMode } from "@/server/services/settings.service";

/** 注册模式请求体 */
const modeSchema = z.object({ mode: z.enum(REGISTRATION_MODES) });

/** 注册模式中文名称 */
const MODE_LABEL = {
  OFF: "关闭注册",
  OPEN: "开放注册",
  INVITE: "邀请码注册",
} as const;

/**
 * 读取开发者注册模式（仅管理员）。
 * @returns 当前注册模式
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    const { registrationMode } = await getSiteSettings();
    return Response.json({ mode: registrationMode }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 更新开发者注册模式（仅管理员），数据库设置优先于任何默认值。
 * @param request HTTP 请求，body 为 { mode }
 * @returns 更新后的注册模式
 */
export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    const parsed = modeSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "注册模式不合法");
    }

    const settings = await updateRegistrationMode(parsed.data.mode);
    await logAudit(
      session.username,
      "settings.registration",
      "注册管理",
      `注册模式：${MODE_LABEL[settings.registrationMode]}`,
    );
    return Response.json(
      { mode: settings.registrationMode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
