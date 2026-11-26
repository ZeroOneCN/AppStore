import { Readable } from "node:stream";
import { assertSameOrigin } from "@/server/http/origin";
import { requireDeveloper } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { stageApkUpload } from "@/server/services/apk-staging.service";
import { getSiteSettings } from "@/server/services/settings.service";

/**
 * 步骤一：开发者暂存上传 APK 并解析。
 * 请求体为二进制流；返回 token、解析结果与全部图标候选。
 * @param request HTTP 请求
 * @returns token、解析结果与图标候选
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const session = await requireDeveloper();
    if (!request.body) {
      throw new AppError("VALIDATION_FAILED", "请求体为空，请以二进制流上传 APK");
    }

    const { maxApkMb } = await getSiteSettings();
    const result = await stageApkUpload({
      body: Readable.fromWeb(
        request.body as unknown as import("node:stream/web").ReadableStream,
      ),
      maxBytes: maxApkMb * 1024 * 1024,
      actor: `dev:${session.username}`,
    });

    return Response.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
