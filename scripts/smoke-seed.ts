/**
 * 冒烟测试种子脚本（临时工具）：创建演示应用与版本，或清理这些数据。
 * 用法：
 *   npx tsx scripts/smoke-seed.ts           # 创建种子数据
 *   npx tsx scripts/smoke-seed.ts --cleanup # 删除种子数据与文件
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import "dotenv/config";
import { parseApk } from "../src/server/services/apk.service";
import { createApp, deleteApp } from "../src/server/services/app.service";
import { createDraft, publish } from "../src/server/services/release.service";
import { prisma } from "../src/server/db";
import { storagePath, toStoredPath } from "../src/server/infra/paths";

const SLUG = "smoke-pack";
const APK_SOURCE = "C:\\Code\\PackKeeper\\dist\\包裹管家-1.0.0-4026.apk";

/**
 * 删除已存在的种子应用（含磁盘文件）。
 * @returns 是否删除过
 */
async function cleanup(): Promise<boolean> {
  const existing = await prisma.app.findUnique({ where: { slug: SLUG } });
  if (!existing) return false;
  await deleteApp(existing.id);
  return true;
}

/**
 * 创建种子应用并发布一个版本。
 * @returns 无
 */
async function seed(): Promise<void> {
  await cleanup();

  const parsed = await parseApk(APK_SOURCE);
  const app = await createApp({
    slug: SLUG,
    name: "包裹管家（冒烟）",
    summary: "冒烟测试用应用",
    description: "仅用于接口冒烟验证，验证完成后会被清理。",
    type: "ANDROID",
    category: "工具",
    tags: ["smoke"],
    packageName: parsed.packageName,
  });

  const targetDir = storagePath("apks", app.id);
  fs.mkdirSync(targetDir, { recursive: true });
  const targetFile = path.join(targetDir, `${parsed.versionCode}.apk`);
  await fsp.copyFile(APK_SOURCE, targetFile);
  const stat = await fsp.stat(targetFile);

  const draft = await createDraft({
    appId: app.id,
    packageName: parsed.packageName,
    versionCode: parsed.versionCode,
    versionName: parsed.versionName,
    minSdk: parsed.minSdk,
    signFingerprint: parsed.signFingerprint,
    filePath: toStoredPath(targetFile),
    fileSize: stat.size,
    sha256: "0".repeat(64),
    changelog: "首个版本",
  });
  const published = await publish(draft.id);

  console.log(
    JSON.stringify(
      {
        slug: app.slug,
        packageName: parsed.packageName,
        versionCode: published.versionCode,
        versionName: published.versionName,
        releaseId: published.id,
        fileSize: stat.size,
      },
      null,
      2,
    ),
  );
}

const isCleanup = process.argv.includes("--cleanup");

(isCleanup ? cleanup() : seed())
  .then(async (result) => {
    if (isCleanup) console.log(result ? "已清理种子数据" : "无需清理");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
