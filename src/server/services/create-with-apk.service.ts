import type { App } from "@prisma/client";
import { prisma } from "../db";
import { AppError } from "../infra/errors";
import { loadStagedUpload } from "./apk-staging.service";
import { uploadApkRelease, type UploadReleaseResult } from "./release-upload.service";

/** 使用暂存安装包创建应用的输入 */
export interface CreateAppWithApkInput {
  /** 审计标记：admin 或 dev:<username> */
  actor: string;
  /** 步骤一暂存上传得到的 token */
  token: string;
  /** 版本更新说明 */
  changelog?: string;
  /** 选择的图标 ID；空字符串表示不设置图标 */
  iconId?: string | null;
  /**
   * 使用解析出的包名创建应用，返回新应用记录。
   * 由调用方根据角色选择管理员或开发者创建逻辑。
   */
  createApp: (packageName: string) => Promise<App>;
}

/**
 * 用暂存 APK 创建应用并发布首个版本：
 * 从暂存会话读取包名创建应用，再复用上传服务落盘并发布。
 * 中途失败会删除已创建的应用，暂存会话保留以便重试提交。
 * @param input 上传者、暂存 token、更新说明与创建回调
 * @returns 新应用与上传结果
 */
export async function createAppWithApk(
  input: CreateAppWithApkInput,
): Promise<{ app: App; upload: UploadReleaseResult }> {
  const staged = await loadStagedUpload(input.token);
  if (staged.actor !== input.actor) {
    throw new AppError("FORBIDDEN", "上传会话不属于当前账号，请重新选择安装包");
  }

  let app: App | null = null;
  try {
    app = await input.createApp(staged.parsed.packageName);
    const upload = await uploadApkRelease({
      app,
      actor: input.actor,
      stagedToken: input.token,
      changelog: input.changelog ?? "",
      autoPublish: true,
      iconId: input.iconId,
    });

    return { app, upload };
  } catch (error) {
    if (app) {
      // 上传失败时回滚应用记录，避免留下没有版本的空白应用
      await prisma.app.delete({ where: { id: app.id } }).catch(() => undefined);
    }
    throw error;
  }
}
