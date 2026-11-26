import type { App } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { createApp } from "../app.service";
import {
  archive,
  createDraft,
  evaluateUpdate,
  listDownloadableReleases,
  publish,
  setCurrent,
} from "../release.service";

const PACKAGE_NAME = "com.demo.notes";

/**
 * 创建测试用 Android 应用。
 * @returns 应用记录
 */
async function seedApp(): Promise<App> {
  return createApp({
    slug: "notes",
    name: "记事本",
    summary: "测试应用",
    type: "ANDROID",
    category: "工具",
    packageName: PACKAGE_NAME,
  });
}

/**
 * 创建版本草稿的简写。
 * @param app 所属应用
 * @param versionCode 版本号
 * @returns 版本记录
 */
async function draft(app: App, versionCode: number, extra: Partial<Parameters<typeof createDraft>[0]> = {}) {
  return createDraft({
    appId: app.id,
    packageName: PACKAGE_NAME,
    versionCode,
    versionName: `1.0.${versionCode}`,
    minSdk: 24,
    signFingerprint: "AA:BB",
    filePath: `apks/${app.id}/${versionCode}.apk`,
    fileSize: 2048,
    sha256: `sha-${versionCode}`,
    ...extra,
  });
}

describe("版本服务", () => {
  beforeEach(async () => {
    await prisma.release.deleteMany();
    await prisma.app.deleteMany();
  });

  it("包名不一致时拒绝创建草稿", async () => {
    const app = await seedApp();
    await expect(draft(app, 2, { packageName: "com.other" })).rejects.toMatchObject({
      code: "PACKAGE_MISMATCH",
    });
  });

  it("记录上传者并按可下载状态筛选历史版本", async () => {
    const app = await seedApp();
    const published = await draft(app, 2, { uploadedBy: "dev:alice" });
    await publish(published.id);
    const archived = await draft(app, 1, { uploadedBy: "admin" });
    await archive(archived.id);
    await draft(app, 3, { uploadedBy: "admin" });

    const stored = await prisma.release.findUniqueOrThrow({ where: { id: published.id } });
    expect(stored.uploadedBy).toBe("dev:alice");

    const downloadable = await listDownloadableReleases(app.id);
    expect(downloadable.map((item) => item.versionCode)).toEqual([2, 1]);
    expect(downloadable.map((item) => item.status)).toEqual(["PUBLISHED", "ARCHIVED"]);
  });

  it("重复版本号返回 VERSION_CONFLICT", async () => {    const app = await seedApp();
    await draft(app, 2);
    await expect(draft(app, 2)).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("发布新版本会取消旧版本的当前标记", async () => {
    const app = await seedApp();
    const first = await draft(app, 1);
    const second = await draft(app, 2);

    await publish(first.id);
    await publish(second.id);

    const releases = await prisma.release.findMany({ where: { appId: app.id } });
    expect(releases.filter((item) => item.isCurrent)).toHaveLength(1);
    expect(releases.find((item) => item.isCurrent)?.versionCode).toBe(2);
    expect(releases.every((item) => item.status === "PUBLISHED")).toBe(true);
  });

  it("回滚当前版本不影响更新判定（仍取最大版本号）", async () => {
    const app = await seedApp();
    const first = await draft(app, 1);
    const second = await draft(app, 2);
    await publish(first.id);
    await publish(second.id);

    await setCurrent(first.id);
    const current = await prisma.release.findFirst({ where: { appId: app.id, isCurrent: true } });
    expect(current?.versionCode).toBe(1);

    const result = await evaluateUpdate(PACKAGE_NAME, 1);
    expect(result.hasUpdate).toBe(true);
    expect(result.latest?.versionCode).toBe(2);
  });

  it("当前版本等于最新版本时无更新", async () => {
    const app = await seedApp();
    const release = await draft(app, 5);
    await publish(release.id);

    const result = await evaluateUpdate(PACKAGE_NAME, 5);
    expect(result.hasUpdate).toBe(false);
    expect(result.latest).toBeNull();
  });

  it("低于最低支持版本时强制更新", async () => {
    const app = await seedApp();
    const release = await draft(app, 10, { minSupportedVersionCode: 8 });
    await publish(release.id);

    const forced = await evaluateUpdate(PACKAGE_NAME, 7);
    expect(forced.hasUpdate).toBe(true);
    expect(forced.forceUpdate).toBe(true);

    const optional = await evaluateUpdate(PACKAGE_NAME, 8);
    expect(optional.hasUpdate).toBe(true);
    expect(optional.forceUpdate).toBe(false);
  });

  it("强制更新标记优先于版本判断", async () => {
    const app = await seedApp();
    const release = await draft(app, 3, { forceUpdate: true });
    await publish(release.id);

    expect((await evaluateUpdate(PACKAGE_NAME, 2)).forceUpdate).toBe(true);
  });

  it("未知包名返回 NOT_FOUND 而不抛错", async () => {
    const result = await evaluateUpdate("com.unknown.app", 1);
    expect(result.hasUpdate).toBe(false);
    expect(result.reason).toBe("NOT_FOUND");
  });

  it("当前版本不能归档，非当前版本可归档且不能再设为当前", async () => {
    const app = await seedApp();
    const first = await draft(app, 1);
    const second = await draft(app, 2);
    await publish(first.id);
    await publish(second.id);

    await expect(archive(second.id)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await archive(first.id);
    await expect(setCurrent(first.id)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
