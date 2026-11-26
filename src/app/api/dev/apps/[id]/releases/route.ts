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
 * 开发者上传 APK：解析成功后默认直接发布为当前版本。
 * 查询参数 publish=0 可仅创建草稿；overwrite=1 表示同版本号强制覆盖。
 * @param request HTTP 请求，二进制请求体
 * @param context 路由参数，id 为应用 ID
 * @returns 版本记录与解析结果
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

    const url = new URL(request.url);
    const overwrite = url.searchParams.get("overwrite") === "1";
    const publishParam = url.searchParams.get("publish");
    const autoPublish = publishParam === null ? true : publishParam === "1";

    const result = await uploadApkRelease({
      app,
      actor: `dev:${session.username}`,
      body: request.body,
      changelog: decodeHeaderValue(request.headers.get("x-version-changelog")),
      overwrite,
      autoPublish,
    });

    await logAudit(
      `dev:${session.username}`,
      "dev.release.upload",
      `${app.name} v${result.release.versionName}`,
      `${(result.release.fileSize / 1024 / 1024).toFixed(1)} MB，版本号 ${result.release.versionCode}，${
        result.overwritten ? "覆盖同版本号，" : ""
      }${autoPublish ? "已发布" : result.overwritten ? "保留原发布状态" : "草稿"}`,
    );

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
