import fs from "node:fs/promises";
import { getSession } from "@/server/http/session";
import { prisma } from "@/server/db";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { resolveStoredPath } from "@/server/infra/paths";

/** 允许对外提供的图片类型 */
const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/**
 * 图标与截图资源接口，公开应用对外可读，私有应用仅管理员与归属开发者可读。
 * @param _request HTTP 请求
 * @param context 路由参数，path 为路径片段数组
 * @returns 图片内容或 404
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  try {
    const segments = (await context.params).path;

    let appId: string | null = null;
    if (segments.length === 2 && segments[0] === "icons" && segments[1].endsWith(".png")) {
      appId = segments[1].slice(0, -".png".length);
    } else if (segments.length === 3 && segments[0] === "screenshots") {
      appId = segments[1];
    }

    if (!appId) throw new AppError("NOT_FOUND", "资源不存在");

    const app = await prisma.app.findUnique({
      where: { id: appId },
      select: { visibility: true, developerId: true },
    });
    if (!app) {
      throw new AppError("NOT_FOUND", "资源不存在");
    }
    // 私有应用的资源仅管理员与归属开发者可读
    const isPublic = app.visibility === "PUBLIC";
    if (!isPublic) {
      const session = await getSession();
      const allowed =
        session?.role === "admin" ||
        (session?.role === "developer" && session.sub === app.developerId);
      if (!allowed) throw new AppError("NOT_FOUND", "资源不存在");
    }

    const extension = segments[segments.length - 1].split(".").pop()?.toLowerCase() ?? "";
    const contentType = MIME_BY_EXTENSION[extension];
    if (!contentType) throw new AppError("NOT_FOUND", "资源不存在");

    const data = await fs.readFile(resolveStoredPath(segments.join("/"))).catch(() => null);
    if (!data) throw new AppError("NOT_FOUND", "资源不存在");

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": isPublic ? "public, max-age=86400" : "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
