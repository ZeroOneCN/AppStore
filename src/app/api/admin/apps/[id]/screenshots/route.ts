import { requireAdmin } from "@/server/http/session";
import { MAX_SCREENSHOT_BYTES } from "@/server/infra/constants";
import { AppError, isAppError, toErrorResponse } from "@/server/infra/errors";
import { appendScreenshot, getAppById, removeScreenshotAt } from "@/server/services/app.service";
import { removeStoredFile, saveScreenshot } from "@/server/services/storage.service";

/**
 * 将存储相对路径列表转换为可访问地址列表。
 * @param paths 存储相对路径
 * @returns 站内资源地址
 */
function toAssetUrls(paths: string[]): string[] {
  return paths.map((path) => `/api/assets/${path}`);
}

/**
 * 追加一张截图。
 * @param request HTTP 请求，multipart 字段名为 file
 * @param context 路由参数，id 为应用 ID
 * @returns 全部截图地址
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;
    await getAppById(id);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_FAILED", "请以 file 字段上传图片");
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "单张截图不能超过 5MB");
    }
    if (!file.type.startsWith("image/")) {
      throw new AppError("UNSUPPORTED_TYPE", "截图仅支持 PNG / JPG / WEBP");
    }

    const storedPath = await saveScreenshot(Buffer.from(await file.arrayBuffer()), id);
    const screenshots = await appendScreenshot(id, storedPath);
    return Response.json(
      { screenshots: toAssetUrls(screenshots) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!isAppError(error)) {
      return toErrorResponse(new AppError("UNSUPPORTED_TYPE", "图片无法识别，请更换文件后重试"));
    }
    return toErrorResponse(error);
  }
}

/**
 * 按索引删除截图，并清理磁盘文件。
 * @param request HTTP 请求，query 参数 index
 * @param context 路由参数，id 为应用 ID
 * @returns 剩余截图地址
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
    const { id } = await context.params;

    const rawIndex = new URL(request.url).searchParams.get("index");
    const index = rawIndex === null ? Number.NaN : Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) {
      throw new AppError("VALIDATION_FAILED", "index 必须为非负整数");
    }

    const { removed, remaining } = await removeScreenshotAt(id, index);
    await removeStoredFile(removed).catch(() => undefined);
    return Response.json(
      { screenshots: toAssetUrls(remaining) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
