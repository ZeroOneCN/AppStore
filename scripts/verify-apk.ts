import "dotenv/config";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { assertZipMagic, parseApk, streamApkToTemp } from "../src/server/services/apk.service";

/**
 * 手动校验工具：对指定 APK 执行 ZIP 头部校验、元信息解析、流式落盘与哈希比对。
 * 用法：npx tsx scripts/verify-apk.ts <apk 路径>
 */
async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) throw new Error("用法：npx tsx scripts/verify-apk.ts <apk 路径>");

  const startedAt = Date.now();
  await assertZipMagic(target);
  const parsed = await parseApk(target);

  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(target);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  const fileSha256 = hash.digest("hex");

  const streamed = await streamApkToTemp(createReadStream(target), 300 * 1024 * 1024);
  await fs.rm(streamed.tempPath, { force: true });

  console.log(
    JSON.stringify(
      {
        file: target,
        packageName: parsed.packageName,
        versionCode: parsed.versionCode,
        versionName: parsed.versionName,
        minSdk: parsed.minSdk,
        iconBytes: parsed.iconBuffer?.byteLength ?? 0,
        signFingerprint: parsed.signFingerprint,
        fileSize: streamed.fileSize,
        fileSha256,
        streamSha256: streamed.sha256,
        sha256Matched: fileSha256 === streamed.sha256,
        elapsedMs: Date.now() - startedAt,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
