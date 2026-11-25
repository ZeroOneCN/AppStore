import { toErrorResponse } from "@/server/infra/errors";
import { getAppBySlug } from "@/server/services/app.service";
import { listPublishedReleases } from "@/server/services/release.service";

/**
 * 应用历史版本列表接口。
 * @param _request HTTP 请求
 * @param context 路由参数
 * @returns 已发布版本列表（版本号倒序）
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const app = await getAppBySlug(slug);
    const releases = await listPublishedReleases(app.id);

    return Response.json(
      {
        total: releases.length,
        items: releases.map((release) => ({
          versionName: release.versionName,
          versionCode: release.versionCode,
          fileSize: release.fileSize,
          changelog: release.changelog,
          publishedAt: release.publishedAt?.toISOString() ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
