import { requireDeveloperApp } from "@/server/http/session";
import { MAX_ICON_BYTES } from "@/server/infra/constants";
import { AppError, isAppError, toErrorResponse } from "@/server/infra/errors";
import { updateAppIcon } from "@/server/services/app.service";
import { saveIcon } from "@/server/services/storage.service";

/**
 * 开发者上传自己应用的图标，统一转换为 512×512 PNG。
 * @param request HTTP 请求，multipart 字段名为 file
 * @param context 路由参数，id 为应用 ID
 * @returns 图标访问地址
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    await requireDeveloperApp(id);

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_FAILED", "请以 file 字段上传图片");
    }
    if (file.size > MAX_ICON_BYTES) {
      throw new AppError("FILE_TOO_LARGE", "图标不能超过 2MB");
    }
    if (!file.type.startsWith("image/")) {
      throw new AppError("UNSUPPORTED_TYPE", "图标仅支持 PNG / JPG / WEBP");
    }

    const storedPath = await saveIcon(Buffer.from(await file.arrayBuffer()), id);
    await updateAppIcon(id, storedPath);
    return Response.json(
      { iconUrl: `/api/assets/${storedPath}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (!isAppError(error)) {
      return toErrorResponse(new AppError("UNSUPPORTED_TYPE", "图片无法识别，请更换文件后重试"));
    }
    return toErrorResponse(error);
  }
}
