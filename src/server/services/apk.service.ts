import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import { Transform, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import AppInfoParser from "app-info-parser";
import forge from "node-forge";
import yauzl from "yauzl";
import { AppError } from "../infra/errors";
import { createTempApkPath } from "./storage.service";

/** APK 文件头（ZIP 本地文件头），用于快速判别非安装包 */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** APK 解析结果 */
export interface ParsedApk {
  /** 应用包名 */
  packageName: string;
  /** 版本号（整数） */
  versionCode: number;
  /** 版本名（展示用） */
  versionName: string;
  /** 最低系统版本 */
  minSdk: number | null;
  /** 图标二进制，缺失时为 null（不阻断发布） */
  iconBuffer: Buffer | null;
  /** 签名证书 SHA-256 指纹，解析失败时为 null */
  signFingerprint: string | null;
}

/**
 * 读取文件头部并校验是否为 ZIP（APK）格式。
 * @param filePath 文件绝对路径
 * @throws AppError 文件头不匹配时抛出 UNSUPPORTED_TYPE
 */
export async function assertZipMagic(filePath: string): Promise<void> {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(4);
    await handle.read(buffer, 0, 4, 0);
    if (!buffer.equals(ZIP_MAGIC)) {
      throw new AppError("UNSUPPORTED_TYPE", "文件不是有效的 APK（缺少 ZIP 文件头）");
    }
  } finally {
    await handle.close();
  }
}

/**
 * 将上传流写入临时文件，同时计算 SHA256 与文件大小，超限立即中断并清理。
 * @param source 可读流（来自请求体）
 * @param maxBytes 允许的最大字节数
 * @returns 临时文件路径、SHA256、文件大小
 * @throws AppError 超过大小上限时抛出 FILE_TOO_LARGE
 */
export async function streamApkToTemp(
  source: Readable,
  maxBytes: number,
): Promise<{ tempPath: string; sha256: string; fileSize: number }> {
  const tempPath = createTempApkPath();
  const hash = createHash("sha256");
  let fileSize = 0;

  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      fileSize += chunk.length;
      if (fileSize > maxBytes) {
        callback(new AppError("FILE_TOO_LARGE", "APK 体积超过上传上限"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(source, meter, createWriteStream(tempPath));
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }

  return { tempPath, sha256: hash.digest("hex"), fileSize };
}

/**
 * 将 base64 data URI 或裸 base64 解码为 Buffer。
 * @param value 解析器返回的图标字段
 * @returns 二进制；无法识别时返回 null
 */
function decodeIcon(value: unknown): Buffer | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value !== "string") return null;

  const base64 = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  try {
    const buffer = Buffer.from(base64, "base64");
    return buffer.byteLength > 0 ? buffer : null;
  } catch {
    return null;
  }
}

/**
 * 从 PKCS#7 签名块中提取证书并计算 SHA-256 指纹。
 * @param pkcs7Buffer .RSA / .DSA / .EC 文件内容
 * @returns 冒号分隔的大写十六进制指纹；解析失败返回 null
 */
function fingerprintFromPkcs7(pkcs7Buffer: Buffer): string | null {
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pkcs7Buffer.toString("binary")));
    const message = forge.pkcs7.messageFromAsn1(asn1);
    const certificate = (message as unknown as { certificates?: forge.pki.Certificate[] })
      .certificates?.[0];
    if (!certificate) return null;

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const digest = createHash("sha256").update(Buffer.from(der, "binary")).digest("hex");
    return (digest.match(/.{2}/g) ?? []).join(":").toUpperCase();
  } catch {
    return null;
  }
}

/**
 * 从 APK 的 META-INF 目录中提取签名证书指纹，按流式读取，避免整体载入大文件。
 * @param filePath APK 绝对路径
 * @returns 指纹字符串或 null
 */
export async function extractSignFingerprint(filePath: string): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    yauzl.open(filePath, { lazyEntries: true }, (openError, zipFile) => {
      if (openError || !zipFile) {
        resolve(null);
        return;
      }

      let settled = false;
      const finish = (value: string | null): void => {
        if (settled) return;
        settled = true;
        try {
          zipFile.close();
        } catch {
          // 已关闭时忽略
        }
        resolve(value);
      };

      zipFile.on("error", () => finish(null));
      zipFile.on("end", () => finish(null));
      zipFile.on("entry", (entry: yauzl.Entry) => {
        if (!/^META-INF\/.+\.(RSA|DSA|EC)$/i.test(entry.fileName)) {
          zipFile.readEntry();
          return;
        }

        zipFile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            finish(null);
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("end", () => finish(fingerprintFromPkcs7(Buffer.concat(chunks))));
          stream.on("error", () => finish(null));
        });
      });

      zipFile.readEntry();
    });
  });
}

/**
 * 解析 APK 元信息：包名、版本、最低系统版本、图标、签名指纹。
 * @param filePath APK 绝对路径
 * @returns APK 解析结果
 * @throws AppError 解析失败或缺少关键字段时抛出 APK_PARSE_FAILED
 */
export async function parseApk(filePath: string): Promise<ParsedApk> {
  let info: Awaited<ReturnType<AppInfoParser["parse"]>>;
  try {
    const parser = new AppInfoParser(filePath);
    info = await parser.parse();
  } catch (error) {
    throw new AppError(
      "APK_PARSE_FAILED",
      `APK 解析失败：${error instanceof Error ? error.message : "未知原因"}`,
    );
  }

  const packageName = info.package ?? info.packageName ?? "";
  const versionCode = Number.parseInt(String(info.versionCode ?? ""), 10);
  const versionName = String(info.versionName ?? "").trim();

  if (!packageName || !versionName || !Number.isFinite(versionCode)) {
    throw new AppError("APK_PARSE_FAILED", "APK 缺少包名、版本名或版本号，无法发布");
  }

  const minSdkValue = Number.parseInt(String(info.minSdkVersion ?? ""), 10);

  return {
    packageName,
    versionCode,
    versionName,
    minSdk: Number.isFinite(minSdkValue) ? minSdkValue : null,
    iconBuffer: decodeIcon(info.application?.icon),
    signFingerprint: await extractSignFingerprint(filePath),
  };
}
