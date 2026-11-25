import { connection } from "next/server";
import { z } from "zod";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { evaluateUpdate } from "@/server/services/release.service";

const querySchema = z.object({
  packageName: z.string().trim().min(3).max(128),
  versionCode: z.coerce.number().int().min(0),
});

/**
 * 更新检查接口：按包名与当前版本号返回是否有更新。
 * 应用不存在时仍返回 200 与 hasUpdate=false，避免客户端反复重试。
 * @param request HTTP 请求
 * @returns 更新检查结果
 */
export async function GET(request: Request): Promise<Response> {
  // 显式声明动态渲染，避免构建期预渲染该接口
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      packageName: params.get("packageName") ?? undefined,
      versionCode: params.get("versionCode") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "packageName 与 versionCode 必须同时提供");
    }

    const result = await evaluateUpdate(parsed.data.packageName, parsed.data.versionCode);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
