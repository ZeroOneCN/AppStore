import { createHmac, timingSafeEqual } from "node:crypto";
import { SIGN_TTL_SECONDS } from "../infra/constants";
import { getEnv } from "../infra/env";
import { AppError } from "../infra/errors";

/**
 * 计算下载链接签名。
 * @param releaseId 版本 ID
 * @param exp 过期时间（Unix 秒）
 * @returns 小写十六进制签名
 */
function computeSignature(releaseId: string, exp: number): string {
  return createHmac("sha256", getEnv().DOWNLOAD_SIGN_SECRET)
    .update(`${releaseId}.${exp}`)
    .digest("hex");
}

/** 签名下载链接结构 */
export interface SignedDownload {
  /** 站内相对路径，含签名参数 */
  path: string;
  /** 绝对地址，供客户端直接使用 */
  url: string;
  /** 过期时间（Unix 秒） */
  expiresAt: number;
}

/**
 * 生成带签名的下载链接。
 * @param releaseId 版本 ID
 * @param ttlSeconds 有效期，默认 600 秒
 * @param now 当前毫秒时间戳，便于测试注入
 * @param origin 当前部署的站点根地址，缺省时回退 BASE_URL
 * @returns 相对路径、绝对地址与过期时间
 */
export function signDownloadPath(
  releaseId: string,
  ttlSeconds = SIGN_TTL_SECONDS,
  now = Date.now(),
  origin?: string,
): SignedDownload {
  const expiresAt = Math.floor(now / 1000) + ttlSeconds;
  const signature = computeSignature(releaseId, expiresAt);
  const path = `/api/download/${releaseId}?exp=${expiresAt}&sig=${signature}`;
  const base = (origin ?? getEnv().BASE_URL).replace(/\/+$/, "");

  return {
    path,
    url: new URL(path, base).toString(),
    expiresAt,
  };
}

/**
 * 校验下载链接签名与有效期。
 * @param releaseId 版本 ID
 * @param exp 链接中的过期时间（Unix 秒）
 * @param signature 链接中的签名
 * @throws AppError 参数缺失返回 VALIDATION_FAILED，过期返回 LINK_EXPIRED，签名不符返回 FORBIDDEN
 */
export function verifyDownloadSignature(releaseId: string, exp: unknown, signature: unknown): void {
  const expiresAt = Number(exp);
  if (!Number.isInteger(expiresAt) || expiresAt <= 0 || typeof signature !== "string") {
    throw new AppError("VALIDATION_FAILED", "下载链接参数不完整");
  }

  if (expiresAt * 1000 < Date.now()) {
    throw new AppError("LINK_EXPIRED", "下载链接已过期，请重新获取");
  }

  const expected = Buffer.from(computeSignature(releaseId, expiresAt), "utf8");
  const actual = Buffer.from(signature, "utf8");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError("FORBIDDEN", "下载链接签名无效");
  }
}
