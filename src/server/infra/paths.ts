import fs from "node:fs";
import path from "node:path";
import { getEnv } from "./env";
import { AppError } from "./errors";

/** 存储根目录下的固定子目录 */
const SUB_DIRS = ["apks", "icons", "screenshots", "tmp"] as const;

/**
 * 解析存储根目录的绝对路径。
 * @returns 绝对路径
 */
export function storageRoot(): string {
  return path.resolve(process.cwd(), getEnv().STORAGE_DIR);
}

/**
 * 确保所有存储子目录存在。
 * @returns 无
 */
export function ensureStorageDirs(): void {
  for (const dir of SUB_DIRS) {
    fs.mkdirSync(path.join(storageRoot(), dir), { recursive: true });
  }
}

/**
 * 校验路径片段不含路径穿越字符。
 * @param segment 单个路径片段
 * @returns 校验通过返回原值
 * @throws AppError 片段非法时抛出
 */
function assertSafeSegment(segment: string): string {
  if (!segment || segment === "." || segment === ".." || /[\\/]/.test(segment)) {
    throw new AppError("VALIDATION_FAILED", `非法的路径片段：${segment}`);
  }
  return segment;
}

/**
 * 拼接存储目录内的绝对路径。
 * @param segments 路径片段，不能包含分隔符或 ..
 * @returns 绝对路径
 */
export function storagePath(...segments: string[]): string {
  return path.join(storageRoot(), ...segments.map(assertSafeSegment));
}

/**
 * 将绝对路径转换为以存储根目录为基准的相对路径（Posix 分隔符）。
 * @param absolutePath 存储目录内的绝对路径
 * @returns 相对路径，如 apks/xxx/12.apk
 */
export function toStoredPath(absolutePath: string): string {
  const relative = path.relative(storageRoot(), absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("VALIDATION_FAILED", "路径不在存储目录内");
  }
  return relative.split(path.sep).join("/");
}

/**
 * 将数据库中的相对路径还原为绝对路径，并校验仍在存储目录内。
 * @param storedPath 相对路径，如 apks/xxx/12.apk
 * @returns 绝对路径
 */
export function resolveStoredPath(storedPath: string): string {
  const absolute = path.resolve(storageRoot(), storedPath);
  const relative = path.relative(storageRoot(), absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("VALIDATION_FAILED", "非法的存储路径");
  }
  return absolute;
}
