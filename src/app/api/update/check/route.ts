import { connection } from "next/server";
import { z } from "zod";
import { originFromRequest } from "@/server/http/base-url";
import { clientKeyFrom } from "@/server/http/session";
import { UPDATE_CHECK_RATE_LIMIT } from "@/server/infra/constants";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { evaluateUpdate } from "@/server/services/release.service";

const querySchema = z.object({
  packageName: z.string().trim().min(3).max(128),
  versionCode: z.coerce.number().int().min(0),
});

/** 单 IP 请求计数（进程内内存实现，多实例部署需换成共享存储） */
const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * 判断当前客户端是否超出更新检查频率限制。
 * @param clientKey 客户端标识（IP）
 * @returns 是否允许本次请求
 */
function consumeQuota(clientKey: string): boolean {
  const now = Date.now();
  const record = hits.get(clientKey);

  if (!record || now >= record.resetAt) {
    // 简单的过期清理，避免长期运行后 Map 无限增长
    if (hits.size > 5000) {
      for (const [key, value] of hits) {
        if (now >= value.resetAt) hits.delete(key);
      }
    }
    hits.set(clientKey, { count: 1, resetAt: now + UPDATE_CHECK_RATE_LIMIT.windowMs });
    return true;
  }

  record.count += 1;
  return record.count <= UPDATE_CHECK_RATE_LIMIT.maxRequests;
}

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
    const clientKey = clientKeyFrom(request);
    if (!consumeQuota(clientKey)) {
      throw new AppError("RATE_LIMITED", "请求过于频繁，请稍后再试");
    }

    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      packageName: params.get("packageName") ?? undefined,
      versionCode: params.get("versionCode") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "packageName 与 versionCode 必须同时提供");
    }

    const result = await evaluateUpdate(
      parsed.data.packageName,
      parsed.data.versionCode,
      originFromRequest(request),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
