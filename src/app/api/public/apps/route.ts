import { connection } from "next/server";
import { z } from "zod";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { listPublicApps } from "@/server/services/app.service";

const querySchema = z.object({
  q: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  tag: z.string().trim().max(50).optional(),
  type: z.enum(["ANDROID", "WEB"]).optional(),
  sort: z.enum(["recent", "name", "downloads"]).optional(),
});

/**
 * 公开应用列表接口。
 * @param request HTTP 请求
 * @returns 应用卡片列表与总数
 */
export async function GET(request: Request): Promise<Response> {
  // 显式声明动态渲染，避免构建期预渲染该接口
  await connection();
  try {
    const params = new URL(request.url).searchParams;
    const parsed = querySchema.safeParse({
      q: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      tag: params.get("tag") ?? undefined,
      type: params.get("type") ?? undefined,
      sort: params.get("sort") ?? undefined,
    });

    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", "查询参数不合法", parsed.error.issues);
    }

    const { q, category, tag, type, sort } = parsed.data;
    const items = await listPublicApps({
      q: q || undefined,
      category: category || undefined,
      tag: tag || undefined,
      type,
      sort,
    });

    return Response.json({ total: items.length, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
