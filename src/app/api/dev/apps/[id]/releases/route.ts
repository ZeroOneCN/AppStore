import { requireDeveloperApp } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { uploadApkRelease } from "@/server/services/release-upload.service";

/**
 * 安全解析 URL 编码的请求头值。
 * @param value 请求头原始值
 * @returns 解码后的文本，解码失败返回原文
 */
function decodeHeaderValue(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * 开发者上传 APK：解析成功后直接发布为当前版本。
 * @param request HTTP 请求，二进制请求体
 * @param context 路由参数，id 为应用 ID
 * @returns 已发布版本与解析结果
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;

  try {
    const { session, app } = await requireDeveloperApp(id);
    if (!request.body) {
      throw new AppError("VALIDATION_FAILED", "请求体为空，请以二进制流上传 APK");
    }

    const result = await uploadApkRelease({
      app,
      actor: `dev:${session.username}`,
      body: request.body,
      changelog: decodeHeaderValue(request.headers.get("x-version-changelog")),
      autoPublish: true,
    });

    await logAudit(
      `dev:${session.username}`,
      "dev.release.upload",
      `${app.name} v${result.release.versionName}`,
      `${(result.release.fileSize / 1024 / 1024).toFixed(1)} MB，版本号 ${result.release.versionCode}，已自动发布`,
    );

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
