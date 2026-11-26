import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { AppError } from "../infra/errors";
import { storagePath } from "../infra/paths";
import { assertZipMagic, parseApk, streamApkToTemp } from "./apk.service";

/** 暂存目录相对 tmp 的子目录 */
const STAGING_DIR = "staging";

/** 暂存有效期：超过 24 小时的会话自动清理 */
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;

/** 暂存 token 格式（UUID） */
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 暂存会话中保存的解析结果 */
export interface StagedApkParsed {
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  signFingerprint: string | null;
  fileSize: number;
  sha256: string;
}

/** 返回给前端的图标候选 */
export interface StagedIconSummary {
  id: string;
  label: string;
  /** base64 data URL，用于步骤二预览选择 */
  dataUrl: string;
}

/** 暂存上传完成后返回给前端的数据 */
export interface StagedApkSummary {
  token: string;
  parsed: StagedApkParsed;
  icons: StagedIconSummary[];
}

/** 落盘的暂存元数据 */
export interface StagedApkMeta {
  token: string;
  actor: string;
  createdAt: string;
  /** 暂存 APK 绝对路径 */
  apkPath: string;
  sha256: string;
  fileSize: number;
  parsed: StagedApkParsed;
  icons: Array<{ id: string; label: string; file: string }>;
}

/**
 * 校验并取得暂存会话目录。
 * @param token 上传 token
 * @returns 暂存目录绝对路径
 * @throws AppError token 非法时抛出
 */
function stagingDir(token: string): string {
  if (!TOKEN_PATTERN.test(token)) {
    throw new AppError("VALIDATION_FAILED", "上传会话无效，请重新选择安装包");
  }
  return storagePath("tmp", STAGING_DIR, token);
}

/**
 * 清理超过有效期的暂存会话，避免临时文件堆积。
 * @returns 无
 */
export async function cleanupExpiredStaging(): Promise<void> {
  const root = storagePath("tmp", STAGING_DIR);
  let entries: string[];
  try {
    entries = await fs.readdir(root);
  } catch {
    return;
  }

  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(/*turbopackIgnore: true*/ root, entry);
      try {
        const stat = await fs.stat(target);
        if (stat.isDirectory() && now - stat.mtimeMs > STAGING_TTL_MS) {
          await fs.rm(target, { recursive: true, force: true });
        }
      } catch {
        // 单个会话清理失败不影响上传
      }
    }),
  );
}

/**
 * 暂存上传：流式落盘 → 校验与解析 → 保存 APK、全部图标候选与元数据。
 * 步骤一调用，步骤三提交时按 token 取出，避免重复上传几十 MB 安装包。
 * @param input 请求体、大小上限与上传者标记
 * @returns token、解析结果与图标候选（含预览图）
 * @throws AppError 文件非法、解析失败或体积超限时抛出
 */
export async function stageApkUpload(input: {
  body: Readable;
  maxBytes: number;
  actor: string;
}): Promise<StagedApkSummary> {
  void cleanupExpiredStaging();

  const uploaded = await streamApkToTemp(input.body, input.maxBytes);
  let stagedTempPath: string | null = uploaded.tempPath;
  let createdDir: string | null = null;

  try {
    await assertZipMagic(uploaded.tempPath);
    const parsed = await parseApk(uploaded.tempPath);

    const token = randomUUID();
    const dir = stagingDir(token);
    createdDir = dir;
    const iconsDir = path.join(/*turbopackIgnore: true*/ dir, "icons");
    await fs.mkdir(iconsDir, { recursive: true });

    const apkPath = path.join(/*turbopackIgnore: true*/ dir, "app.apk");
    try {
      await fs.rename(uploaded.tempPath, apkPath);
    } catch (error) {
      // 跨磁盘分区时退化为复制后删除
      if ((error as NodeJS.ErrnoException).code === "EXDEV") {
        await fs.copyFile(uploaded.tempPath, apkPath);
        await fs.rm(uploaded.tempPath, { force: true });
      } else {
        throw error;
      }
    }
    stagedTempPath = null;

    const icons: StagedApkMeta["icons"] = [];
    const summaries: StagedIconSummary[] = [];
    for (const icon of parsed.icons) {
      const fileName = `${icon.id}.png`;
      await fs.writeFile(path.join(/*turbopackIgnore: true*/ iconsDir, fileName), icon.buffer);
      icons.push({ id: icon.id, label: icon.label, file: `icons/${fileName}` });
      summaries.push({
        id: icon.id,
        label: icon.label,
        dataUrl: `data:image/png;base64,${icon.buffer.toString("base64")}`,
      });
    }

    const meta: StagedApkMeta = {
      token,
      actor: input.actor,
      createdAt: new Date().toISOString(),
      apkPath,
      sha256: uploaded.sha256,
      fileSize: uploaded.fileSize,
      parsed: {
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        signFingerprint: parsed.signFingerprint,
        fileSize: uploaded.fileSize,
        sha256: uploaded.sha256,
      },
      icons,
    };
    await fs.writeFile(
      path.join(/*turbopackIgnore: true*/ dir, "meta.json"),
      JSON.stringify(meta),
      "utf8",
    );

    return { token, parsed: meta.parsed, icons: summaries };
  } catch (error) {
    if (createdDir) {
      await fs.rm(createdDir, { recursive: true, force: true }).catch(() => undefined);
    }
    if (stagedTempPath) await fs.rm(stagedTempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

/**
 * 读取暂存会话元数据。
 * @param token 上传 token
 * @returns 元数据
 * @throws AppError 会话不存在或已过期时抛出
 */
export async function loadStagedUpload(token: string): Promise<StagedApkMeta> {
  const dir = stagingDir(token);
  const raw = await fs
    .readFile(path.join(/*turbopackIgnore: true*/ dir, "meta.json"), "utf8")
    .catch(() => null);
  if (!raw) {
    throw new AppError("VALIDATION_FAILED", "上传会话不存在或已过期，请重新选择安装包");
  }

  let meta: StagedApkMeta;
  try {
    meta = JSON.parse(raw) as StagedApkMeta;
  } catch {
    throw new AppError("VALIDATION_FAILED", "上传会话已损坏，请重新选择安装包");
  }

  if (Date.now() - new Date(meta.createdAt).getTime() > STAGING_TTL_MS) {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw new AppError("VALIDATION_FAILED", "上传会话已过期，请重新选择安装包");
  }
  return meta;
}

/**
 * 读取暂存会话中用户选中的图标。
 * @param meta 暂存元数据
 * @param iconId 图标 ID，空字符串表示保留原图标
 * @returns PNG 缓冲；未选择或不存在时返回 null
 */
export async function readStagedIcon(
  meta: StagedApkMeta,
  iconId: string | null | undefined,
): Promise<Buffer | null> {
  if (!iconId) return null;
  const icon = meta.icons.find((item) => item.id === iconId);
  if (!icon) return null;
  const file = path.join(
    /*turbopackIgnore: true*/ path.dirname(meta.apkPath),
    ...icon.file.split("/"),
  );
  return fs.readFile(file).catch(() => null);
}

/**
 * 把暂存 APK 复制到正式版本目录（保留暂存文件，失败可重试提交）。
 * @param meta 暂存元数据
 * @param appId 应用 ID
 * @param versionCode 版本号
 * @returns 以存储根目录为基准的相对路径
 */
export async function promoteStagedApk(
  meta: StagedApkMeta,
  appId: string,
  versionCode: number,
): Promise<string> {
  const dir = storagePath("apks", appId);
  await fs.mkdir(dir, { recursive: true });
  const destination = path.join(/*turbopackIgnore: true*/ dir, `${versionCode}.apk`);

  try {
    await fs.copyFile(meta.apkPath, destination);
  } catch (error) {
    // Windows 下目标文件可能被短暂占用，删除后重试一次
    if (["EPERM", "EACCES", "EBUSY"].includes((error as NodeJS.ErrnoException).code ?? "")) {
      await fs.rm(destination, { force: true });
      await fs.copyFile(meta.apkPath, destination);
    } else {
      throw error;
    }
  }

  return `apks/${appId}/${versionCode}.apk`;
}

/**
 * 删除暂存会话目录（APK、图标与元数据）。
 * @param token 上传 token
 * @returns 无
 */
export async function removeStagedUpload(token: string): Promise<void> {
  await fs.rm(stagingDir(token), { recursive: true, force: true }).catch(() => undefined);
}
