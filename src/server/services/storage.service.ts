import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ICON_SIZE, MAX_SCREENSHOT_BYTES } from "../infra/constants";
import { AppError } from "../infra/errors";
import { ensureStorageDirs, resolveStoredPath, storagePath, toStoredPath } from "../infra/paths";

/** 允许的截图格式 → 落盘扩展名 */
const SCREENSHOT_EXTENSIONS: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
};

/**
 * 生成临时文件路径（用于 APK 边下载边写入）。
 * @returns 绝对路径
 */
export function createTempApkPath(): string {
  ensureStorageDirs();
  return storagePath("tmp", `${randomUUID()}.apk`);
}

/**
 * 保存应用图标：统一转 512×512 PNG。
 * @param buffer 图片二进制
 * @param appId 应用 ID，决定文件位置
 * @returns 以存储根目录为基准的相对路径
 */
export async function saveIcon(buffer: Buffer, appId: string): Promise<string> {
  ensureStorageDirs();
  const destination = storagePath("icons", `${appId}.png`);
  await sharp(buffer)
    .resize(ICON_SIZE, ICON_SIZE, { fit: "cover" })
    .png()
    .toFile(destination);
  return toStoredPath(destination);
}

/**
 * 保存网页作品截图，保留原图格式。
 * @param buffer 图片二进制
 * @param appId 应用 ID
 * @returns 以存储根目录为基准的相对路径
 */
export async function saveScreenshot(buffer: Buffer, appId: string): Promise<string> {
  if (buffer.byteLength > MAX_SCREENSHOT_BYTES) {
    throw new AppError("FILE_TOO_LARGE", "单张截图不能超过 5MB");
  }

  const metadata = await sharp(buffer).metadata();
  const extension = metadata.format ? SCREENSHOT_EXTENSIONS[metadata.format] : undefined;
  if (!extension) {
    throw new AppError("UNSUPPORTED_TYPE", "截图仅支持 PNG / JPG / WEBP");
  }

  ensureStorageDirs();
  const dir = storagePath("screenshots", appId);
  await fs.mkdir(dir, { recursive: true });
  const destination = path.join(dir, `${randomUUID()}.${extension}`);
  await sharp(buffer).toFile(destination);
  return toStoredPath(destination);
}

/**
 * 将临时 APK 移动到正式目录。
 * @param tempPath 临时文件绝对路径
 * @param appId 应用 ID
 * @param versionCode 版本号，作为文件名
 * @returns 以存储根目录为基准的相对路径
 */
export async function moveApkToFinal(
  tempPath: string,
  appId: string,
  versionCode: number,
): Promise<string> {
  ensureStorageDirs();
  const dir = storagePath("apks", appId);
  await fs.mkdir(dir, { recursive: true });
  const destination = path.join(dir, `${versionCode}.apk`);

  try {
    await fs.rename(tempPath, destination);
  } catch (error) {
    // 跨磁盘分区时 rename 会失败，退化为复制后删除
    if ((error as NodeJS.ErrnoException).code === "EXDEV") {
      await fs.copyFile(tempPath, destination);
      await fs.rm(tempPath, { force: true });
    } else {
      throw error;
    }
  }

  return toStoredPath(destination);
}

/**
 * 删除单个存储文件，忽略不存在的情况。
 * @param storedPath 以存储根目录为基准的相对路径
 * @returns 无
 */
export async function removeStoredFile(storedPath: string): Promise<void> {
  const absolute = resolveStoredPath(storedPath);
  await fs.rm(absolute, { force: true });
}

/**
 * 删除某个应用关联的全部磁盘文件（APK、截图、图标）。
 * @param appId 应用 ID
 * @returns 无
 */
export async function removeAppFiles(appId: string): Promise<void> {
  const targets = [storagePath("apks", appId), storagePath("screenshots", appId)];
  await Promise.all(targets.map((target) => fs.rm(target, { recursive: true, force: true })));
  await fs.rm(storagePath("icons", `${appId}.png`), { force: true });
}

/**
 * 判断存储文件是否存在。
 * @param storedPath 以存储根目录为基准的相对路径
 * @returns 存在返回 true
 */
export async function storedFileExists(storedPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(resolveStoredPath(storedPath));
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * 获取存储文件大小。
 * @param storedPath 以存储根目录为基准的相对路径
 * @returns 字节数
 * @throws AppError 文件不存在时抛出 NOT_FOUND
 */
export async function storedFileSize(storedPath: string): Promise<number> {
  try {
    const stat = await fs.stat(resolveStoredPath(storedPath));
    return stat.size;
  } catch {
    throw new AppError("NOT_FOUND", "文件不存在或已被清理");
  }
}
