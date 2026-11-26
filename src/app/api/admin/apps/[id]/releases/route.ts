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
 * 查询参数 overwrite=1 表示同版本号强制覆盖，publish=1 表示上传后立即发布。
 * @param request HTTP 请求，content-type 建议 application/octet-stream
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
    const app = await getAppById(id);
    if (!request.body) {
      throw new AppError("VALIDATION_FAILED", "请求体为空，请以二进制流上传 APK");
    }

    const url = new URL(request.url);
    const overwrite = url.searchParams.get("overwrite") === "1";
    const autoPublish = url.searchParams.get("publish") === "1";

    const result = await uploadApkRelease({
      app,
      actor: "admin",
      body: request.body,
      changelog: decodeHeaderValue(request.headers.get("x-version-changelog")),
      overwrite,
      autoPublish,
    });

    await logAudit(
      session.username,
      result.overwritten ? "release.overwrite" : "release.upload",
      `${app.name} v${result.release.versionName}`,
      [
        `${(result.release.fileSize / 1024 / 1024).toFixed(1)} MB`,
        `版本号 ${result.release.versionCode}`,
        result.overwritten ? "覆盖同版本号" : null,
        result.overwritten
          ? autoPublish
            ? "并发布为当前版本"
            : "保留原发布状态"
          : autoPublish
            ? "已发布"
            : "草稿",
      ]
        .filter(Boolean)
        .join("，"),
    );

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
