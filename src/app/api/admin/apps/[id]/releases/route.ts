import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { getAppById } from "@/server/services/app.service";
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
 * 上传 APK 并创建版本草稿。
 * 请求体为二进制流，边落盘边计算 SHA256；解析成功后移入正式目录并写入草稿。
 * @param request HTTP 请求，content-type 建议 application/octet-stream
 * @param context 路由参数，id 为应用 ID
 * @returns 版本草稿与解析结果
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await requireAdmin();
  const { id } = await context.params;

  try {
    const app = await getAppById(id);
    if (!request.body) {
      throw new AppError("VALIDATION_FAILED", "请求体为空，请以二进制流上传 APK");
    }

    const result = await uploadApkRelease({
      app,
      actor: "admin",
      body: request.body,
      changelog: decodeHeaderValue(request.headers.get("x-version-changelog")),
    });

    await logAudit(
      session.username,
      "release.upload",
      `${app.name} v${result.release.versionName}`,
      `${(result.release.fileSize / 1024 / 1024).toFixed(1)} MB，版本号 ${result.release.versionCode}`,
    );

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
