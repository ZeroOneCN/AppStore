import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetEnvCache } from "../../infra/env";
import { AppError } from "../../infra/errors";
import { assertZipMagic, parseApk, streamApkToTemp } from "../apk.service";

const workDir = path.join(os.tmpdir(), `appstore-apk-test-${randomUUID()}`);

describe("APK 服务", () => {
  beforeEach(async () => {
    resetEnvCache();
    process.env.BASE_URL = "http://127.0.0.1:3000";
    process.env.DATABASE_URL = "file:../data/test.db";
    process.env.DOWNLOAD_SIGN_SECRET = "s".repeat(32);
    process.env.SESSION_SECRET = "t".repeat(32);
    process.env.STORAGE_DIR = workDir;
    await fs.mkdir(path.join(workDir, "tmp"), { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(workDir, { recursive: true, force: true });
  });

  it("非 ZIP 文件头被拒绝", async () => {
    const file = path.join(workDir, "tmp", "plain.apk");
    await fs.writeFile(file, "not-a-zip");
    await expect(assertZipMagic(file)).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
  });

  it("ZIP 文件头通过校验", async () => {
    const file = path.join(workDir, "tmp", "magic.apk");
    await fs.writeFile(file, Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]));
    await expect(assertZipMagic(file)).resolves.toBeUndefined();
  });

  it("流式落盘并计算 SHA256", async () => {
    const payload = Buffer.from("apk-content-for-hash");
    const result = await streamApkToTemp(Readable.from([payload]), 1024);

    expect(result.fileSize).toBe(payload.byteLength);
    expect(result.sha256).toBe(createHash("sha256").update(payload).digest("hex"));
    await expect(fs.stat(result.tempPath)).resolves.toBeTruthy();
  });

  it("超过大小上限时中断并清理临时文件", async () => {
    const tmpDir = path.join(workDir, "tmp");
    const before = (await fs.readdir(tmpDir)).length;
    const payload = Buffer.alloc(64, 1);

    await expect(streamApkToTemp(Readable.from([payload]), 16)).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });

    const after = (await fs.readdir(tmpDir)).length;
    expect(after).toBe(before);
  });

  it("非法 APK 解析抛出 APK_PARSE_FAILED", async () => {
    const file = path.join(workDir, "tmp", "broken.apk");
    await fs.writeFile(file, Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    await expect(parseApk(file)).rejects.toBeInstanceOf(AppError);
    await expect(parseApk(file)).rejects.toMatchObject({ code: "APK_PARSE_FAILED" });
  });
});
