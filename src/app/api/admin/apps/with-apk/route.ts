import { appCreateSchema } from "@/server/http/app-schema";
import { readAppWithApkForm, parseFormTags } from "@/server/http/app-upload-form";
import { requireAdmin } from "@/server/http/session";
import { AppError, toErrorResponse } from "@/server/infra/errors";
import { createApp } from "@/server/services/app.service";
import { logAudit } from "@/server/services/audit.service";
import { createAppWithApk } from "@/server/services/create-with-apk.service";

/**
 * 管理员一步创建应用并上传首个 APK 版本。
 * 表单字段：应用信息（含置顶、归属开发者）+ apk 文件 + changelog。
 * @param request HTTP 请求
 * @returns 新应用与版本信息
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdmin();
    const { values, apk } = await readAppWithApkForm(request);
    const tags = parseFormTags(values.tags);

    const result = await createAppWithApk({
      actor: session.username,
      body: apk.stream() as unknown as ReadableStream<Uint8Array>,
      changelog: values.changelog,
      createApp: async (packageName) => {
        const parsed = appCreateSchema.safeParse({
          slug: values.slug ?? "",
          name: values.name ?? "",
          summary: values.summary ?? "",
          description: values.description || undefined,
          type: "ANDROID",
          category: values.category ?? "",
          tags,
          webUrl: null,
          packageName,
          visibility: values.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC",
          pinned: values.pinned === "true",
          developerId: values.developerId || null,
        });
        if (!parsed.success) {
          throw new AppError(
            "VALIDATION_FAILED",
            parsed.error.issues[0]?.message ?? "应用字段不合法",
          );
        }
        return createApp(parsed.data);
      },
    });

    await logAudit(
      session.username,
      "app.create",
      result.app.name,
      `访问标识 /${result.app.slug}，随包创建 v${result.upload.release.versionName}`,
    );
    await logAudit(
      session.username,
      "release.upload",
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
