import type { App } from "@prisma/client";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { prisma } from "../db";
import { assertZipMagic, parseApk, streamApkToTemp } from "./apk.service";
import { uploadApkRelease, type UploadReleaseResult } from "./release-upload.service";
import { getSiteSettings } from "./settings.service";

/** 创建应用并上传安装包的输入 */
export interface CreateAppWithApkInput {
  /** 审计标记：admin 或 dev:<username> */
  actor: string;
  /** APK 二进制流 */
  body: ReadableStream<Uint8Array>;
  /** 版本更新说明 */
  changelog?: string;
  /**
   * 使用解析出的包名创建应用，返回新应用记录。
   * 由调用方根据角色选择管理员或开发者创建逻辑。
   */
  createApp: (packageName: string) => Promise<App>;
}

/**
 * 一步创建应用并上传首个 APK 版本：
 * 先落盘解析包名，再创建应用，最后复用上传服务写入版本并自动发布。
 * 中途失败会删除已创建的应用与临时文件，避免留下空应用。
 * @param input 上传者、请求体、更新说明与创建回调
 * @returns 新应用与上传结果
 */
export async function createAppWithApk(
  input: CreateAppWithApkInput,
): Promise<{ app: App; upload: UploadReleaseResult }> {
  const { maxApkMb } = await getSiteSettings();
  const maxBytes = maxApkMb * 1024 * 1024;
  let tempPath: string | null = null;
  let app: App | null = null;

  try {
    const uploaded = await streamApkToTemp(
      Readable.fromWeb(input.body as unknown as import("node:stream/web").ReadableStream),
      maxBytes,
    );
    tempPath = uploaded.tempPath;

    await assertZipMagic(tempPath);
    const parsed = await parseApk(tempPath);

    app = await input.createApp(parsed.packageName);

    const buffer = await fs.readFile(tempPath);
    const upload = await uploadApkRelease({
      app,
      actor: input.actor,
      body: Readable.toWeb(
        Readable.from(buffer),
      ) as unknown as ReadableStream<Uint8Array>,
      changelog: input.changelog ?? "",
      autoPublish: true,
    });

    return { app, upload };
  } catch (error) {
    if (app) {
      // 上传失败时回滚应用记录，避免留下没有版本的空白应用
      await prisma.app.delete({ where: { id: app.id } }).catch(() => undefined);
    }
    throw error;
  } finally {
    if (tempPath) {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}
