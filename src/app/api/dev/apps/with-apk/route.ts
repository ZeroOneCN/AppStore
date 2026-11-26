import { z } from "zod";
import { devAppCreateSchema } from "@/server/http/dev-app-schema";
import { assertSameOrigin } from "@/server/http/origin";
import { requireDeveloper } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { logAudit } from "@/server/services/audit.service";
import { createAppWithApk } from "@/server/services/create-with-apk.service";
import { createDeveloperApp } from "@/server/services/developer.service";

/** 步骤三：用暂存 APK 创建应用的参数 */
const stagedCreateSchema = z.object({
  token: z.string().min(1, "缺少上传会话"),
  slug: z.string().optional().default(""),
  name: z.string().optional().default(""),
  summary: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  tags: z.array(z.string()).optional().default([]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional().default("PUBLIC"),
  changelog: z.string().max(2000).optional().default(""),
  iconId: z.string().max(64).nullable().optional(),
});

/**
 * 步骤三：开发者用暂存安装包创建应用并发布首个版本。
 * @param request JSON 请求
 * @returns 新应用与版本信息
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
    const session = await requireDeveloper();

    const body = await request.json().catch(() => null);
    const parsedBody = stagedCreateSchema.safeParse(body);
    if (!parsedBody.success) {
      throw new AppError(
        "VALIDATION_FAILED",
        parsedBody.error.issues[0]?.message ?? "提交参数不合法",
      );
    }
    const values = parsedBody.data;

    const result = await createAppWithApk({
      actor: `dev:${session.username}`,
      token: values.token,
      changelog: values.changelog,
      iconId: values.iconId,
      createApp: async (packageName) => {
        const parsed = devAppCreateSchema.safeParse({
          slug: values.slug,
          name: values.name,
          summary: values.summary,
          description: values.description || undefined,
          type: "ANDROID",
          category: values.category,
          tags: values.tags,
          webUrl: null,
          packageName,
          visibility: values.visibility,
        });
        if (!parsed.success) {
          throw new AppError(
            "VALIDATION_FAILED",
            parsed.error.issues[0]?.message ?? "应用字段不合法",
          );
        }
        return createDeveloperApp(session.sub, parsed.data);
      },
    });

    await logAudit(
      `dev:${session.username}`,
      "dev.app.create",
      result.app.name,
      `访问标识 /${result.app.slug}，随包创建 v${result.upload.release.versionName}`,
    );
    await logAudit(
      `dev:${session.username}`,
      "dev.release.upload",
      `${result.app.name} v${result.upload.release.versionName}`,
      `${(result.upload.release.fileSize / 1024 / 1024).toFixed(1)} MB，已自动发布`,
    );

    return Response.json(
      {
        id: result.app.id,
        slug: result.app.slug,
        release: result.upload.release,
        parsed: result.upload.parsed,
        iconSaved: result.upload.iconSaved,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
