import { z } from "zod";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { getAppById } from "@/server/services/app.service";
import { logAudit } from "@/server/services/audit.service";
import { uploadApkRelease } from "@/server/services/release-upload.service";

/** 步骤三提交参数 */
const commitSchema = z.object({
  token: z.string().min(1, "缺少上传会话"),
  changelog: z.string().max(2000).optional().default(""),
  iconId: z.string().max(64).nullable().optional(),
  overwrite: z.boolean().optional().default(false),
  publish: z.boolean().optional().default(false),
});

/**
 * 步骤三：用暂存安装包提交新版本。
 * 支持覆盖同版本号，并按 publish 决定立即发布还是保存草稿。
 * @param request JSON 请求，包含 token、更新日志、图标选择与发布选项
 * @param context 路由参数，id 为应用 ID
 * @returns 版本记录与解析结果
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAdmin();
  const { id } = await context.params;

  try {
    const body = await request.json().catch(() => null);
    const parsed = commitSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        parsed.error.issues[0]?.message ?? "提交参数不合法",
      );
    }

    const app = await getAppById(id);
    const { token, changelog, iconId, overwrite, publish } = parsed.data;

    const result = await uploadApkRelease({
      app,
      actor: session.username,
      stagedToken: token,
      changelog,
      iconId,
      overwrite,
      autoPublish: publish,
    });

    await logAudit(
      session.username,
      result.overwritten ? "release.overwrite" : "release.upload",
      `${app.name} v${result.release.versionName}`,
      [
        `${(result.release.fileSize / 1024 / 1024).toFixed(1)} MB`,
        `版本号 ${result.release.versionCode}`,
        result.overwritten ? "覆盖同版本号" : null,
        publish ? "已发布" : result.overwritten ? "保留原发布状态" : "草稿",
      ]
        .filter(Boolean)
        .join("，"),
    );

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
