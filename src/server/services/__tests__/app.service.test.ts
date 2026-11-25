import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import {
  createApp,
  deleteApp,
  getAppBySlug,
  listAdminApps,
  listPublicApps,
  updateApp,
} from "../app.service";

/** Android 应用基础字段 */
const ANDROID_BASE = {
  name: "记事本",
  summary: "轻量本地笔记",
  type: "ANDROID" as const,
  category: "工具",
  packageName: "com.demo.notes",
};

describe("应用服务", () => {
  beforeEach(async () => {
    await prisma.release.deleteMany();
    await prisma.app.deleteMany();
  });

  it("创建 Android 应用并默认公开", async () => {
    const app = await createApp({ ...ANDROID_BASE, slug: "notes" });
    expect(app.slug).toBe("notes");
    expect(app.visibility).toBe("PUBLIC");
    expect(app.pinned).toBe(false);
  });

  it("重复 slug 自动追加序号，重复包名会被拒绝", async () => {
    await createApp({ ...ANDROID_BASE, slug: "notes" });
    const duplicated = await createApp({
      ...ANDROID_BASE,
      slug: "notes",
      packageName: "com.demo.other",
    });
    expect(duplicated.slug).toBe("notes-2");
    await expect(createApp({ ...ANDROID_BASE, slug: "notes-3" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("Android 缺包名、网页作品缺链接均被拒绝", async () => {
    await expect(
      createApp({ ...ANDROID_BASE, slug: "no-pkg", packageName: "" }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await expect(
      createApp({
        name: "作品",
        summary: "网页作品",
        slug: "web-demo",
        type: "WEB",
        category: "网页",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("列表仅返回公开应用且置顶优先", async () => {
    await createApp({ ...ANDROID_BASE, slug: "a-first" });
    await createApp({
      name: "私有应用",
      summary: "不该出现",
      slug: "hidden",
      type: "ANDROID",
      category: "工具",
      packageName: "com.demo.hidden",
      visibility: "PRIVATE",
    });
    await createApp({
      name: "置顶应用",
      summary: "置顶优先",
      slug: "pinned",
      type: "WEB",
      category: "网页",
      webUrl: "https://example.com",
      pinned: true,
    });

    const list = await listPublicApps({});
    expect(list.map((item) => item.slug)).toEqual(["pinned", "a-first"]);

    const adminList = await listAdminApps();
    expect(adminList).toHaveLength(3);
  });

  it("支持关键词、分类、标签与类型筛选", async () => {
    await createApp({ ...ANDROID_BASE, slug: "notes", tags: ["笔记", "离线"] });
    await createApp({
      name: "计算器",
      summary: "科学计算",
      slug: "calc",
      type: "ANDROID",
      category: "工具",
      packageName: "com.demo.calc",
      tags: ["数学"],
    });
    await createApp({
      name: "作品集",
      summary: "个人主页",
      slug: "portfolio",
      type: "WEB",
      category: "网页",
      webUrl: "https://example.com",
    });

    expect((await listPublicApps({ q: "记事" })).map((item) => item.slug)).toEqual(["notes"]);
    expect((await listPublicApps({ category: "网页" })).map((item) => item.slug)).toEqual([
      "portfolio",
    ]);
    expect((await listPublicApps({ tag: "数学" })).map((item) => item.slug)).toEqual(["calc"]);
    expect((await listPublicApps({ type: "WEB" })).map((item) => item.slug)).toEqual(["portfolio"]);
  });

  it("详情返回截图地址与当前版本信息", async () => {
    const app = await createApp({
      ...ANDROID_BASE,
      slug: "notes",
    });
    await prisma.app.update({
      where: { id: app.id },
      data: {
        iconPath: `icons/${app.id}.png`,
        screenshots: JSON.stringify([`screenshots/${app.id}/one.png`]),
      },
    });
    await prisma.release.create({
      data: {
        appId: app.id,
        versionName: "1.2.0",
        versionCode: 12,
        filePath: `apks/${app.id}/12.apk`,
        fileSize: 1024,
        sha256: "abc",
        status: "PUBLISHED",
        isCurrent: true,
        publishedAt: new Date(),
      },
    });

    const detail = await getAppBySlug("notes");
    expect(detail.iconUrl).toBe(`/api/assets/icons/${app.id}.png`);
    expect(detail.screenshots).toEqual([`/api/assets/screenshots/${app.id}/one.png`]);
    expect(detail.currentRelease?.versionCode).toBe(12);
    expect(detail.currentRelease?.downloadUrl).toContain("/api/download/");
    expect(detail.releases).toHaveLength(1);
  });

  it("私有应用详情对前台不可见", async () => {
    await createApp({
      ...ANDROID_BASE,
      slug: "secret",
      visibility: "PRIVATE",
    });
    await expect(getAppBySlug("secret")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getAppBySlug("secret", true)).resolves.toBeTruthy();
  });

  it("更新应用信息并保持唯一性约束", async () => {
    const app = await createApp({ ...ANDROID_BASE, slug: "notes" });
    const updated = await updateApp(app.id, { name: "记事本 Pro" });
    expect(updated.name).toBe("记事本 Pro");

    await createApp({
      name: "另一个",
      summary: "占位",
      slug: "other",
      type: "ANDROID",
      category: "工具",
      packageName: "com.demo.other",
    });
    await expect(updateApp(app.id, { slug: "other" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("删除应用级联删除版本记录", async () => {
    const app = await createApp({ ...ANDROID_BASE, slug: "notes" });
    await prisma.release.create({
      data: {
        appId: app.id,
        versionName: "1.0.0",
        versionCode: 1,
        filePath: `apks/${app.id}/1.apk`,
        fileSize: 10,
        sha256: "x",
        status: "PUBLISHED",
        isCurrent: true,
      },
    });

    await deleteApp(app.id);
    expect(await prisma.app.count()).toBe(0);
    expect(await prisma.release.count()).toBe(0);
  });
});
