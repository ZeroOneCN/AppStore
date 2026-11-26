import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { getSiteSettings, updateSiteSettings } from "@/server/services/settings.service";

/** 站点配置请求体 */
const settingsSchema = z.object({
  siteName: z.string().trim().min(1, "站点名称不能为空").max(40, "站点名称最多 40 个字符"),
  maxApkMb: z.number().int().min(1).max(4096),
  baseUrl: z
    .string()
    .trim()
    .max(200)
    .refine((value) => value === "" || /^https?:\/\/\S+$/.test(value), {
      message: "站点地址需以 http:// 或 https:// 开头",
    }),
});

/**
 * 读取站点配置（仅管理员）。
 * @returns 当前配置
 */
export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
    return Response.json(await getSiteSettings(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * 更新站点配置（仅管理员）。
 * @param request HTTP 请求
 * @returns 更新后的配置
 */
export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();
    const body: unknown = await request.json().catch(() => null);
    const parsed = settingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", parsed.error.issues[0]?.message ?? "配置不合法");
    }

    const settings = await updateSiteSettings(parsed.data);
    await logAudit(session.username, "settings.update", "站点设置", `站点名称：${settings.siteName}`);
    return Response.json(settings, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
