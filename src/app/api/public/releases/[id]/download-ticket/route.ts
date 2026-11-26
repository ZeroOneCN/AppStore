import { AppError, toErrorResponse } from "@/server/infra/errors";
import { originFromRequest } from "@/server/http/base-url";
import { getReleaseWithApp } from "@/server/services/release.service";
import { signDownloadPath } from "@/server/services/signing.service";

/**
 * 获取签名下载链接的票据接口。
 * @param request HTTP 请求
 * @param context 路由参数
 * @returns 签名后的下载地址与过期时间
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const { id } = await context.params;
    const release = await getReleaseWithApp(id);

    if (release.status === "DRAFT" || release.app.visibility !== "PUBLIC") {
      throw new AppError("NOT_FOUND", "版本不存在或未公开");
    }

    const signed = signDownloadPath(release.id, undefined, undefined, originFromRequest(request));
    return Response.json(
      { url: signed.url, path: signed.path, expiresAt: signed.expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
