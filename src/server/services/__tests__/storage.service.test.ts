import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "../../infra/env";
import { AppError } from "../../infra/errors";
import { resolveStoredPath } from "../../infra/paths";
import {
  removeAppFiles,
  saveIcon,
  saveScreenshot,
  storedFileExists,
  storedFileSize,
} from "../storage.service";

const workDir = path.join(os.tmpdir(), `appstore-storage-test-${randomUUID()}`);

/** 生成 8×8 的红色 PNG */
async function samplePng(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

describe("存储服务", () => {
  beforeEach(() => {
    resetEnvCache();
    process.env.BASE_URL = "http://127.0.0.1:3000";
    process.env.DATABASE_URL = "file:../data/test.db";
    process.env.DOWNLOAD_SIGN_SECRET = "s".repeat(32);
    process.env.SESSION_SECRET = "t".repeat(32);
    process.env.STORAGE_DIR = workDir;
  });

  afterAll(async () => {
    await fs.rm(workDir, { recursive: true, force: true });
  });

  it("图标统一转换为 512×512 PNG", async () => {
    const stored = await saveIcon(await samplePng(), "app-icon");
    expect(stored).toBe("icons/app-icon.png");

    const metadata = await sharp(resolveStoredPath(stored)).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
  });

  it("截图保留 PNG 格式并记录大小", async () => {
    const stored = await saveScreenshot(await samplePng(), "app-shot");
    expect(stored.startsWith("screenshots/app-shot/")).toBe(true);
    expect(stored.endsWith(".png")).toBe(true);
    expect(await storedFileExists(stored)).toBe(true);
    expect(await storedFileSize(stored)).toBeGreaterThan(0);
  });

  it("拒绝穿越存储根目录的路径", () => {
    expect(() => resolveStoredPath("../outside.txt")).toThrow(AppError);
  });

  it("removeAppFiles 清理该应用的全部文件", async () => {
    const icon = await saveIcon(await samplePng(), "app-remove");
    const shot = await saveScreenshot(await samplePng(), "app-remove");

    await removeAppFiles("app-remove");

    expect(await storedFileExists(icon)).toBe(false);
    expect(await storedFileExists(shot)).toBe(false);
  });
});
