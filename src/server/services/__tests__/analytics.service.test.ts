import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { createApp } from "../app.service";
import { getAnalyticsOverview, recordInstall, recordPageView } from "../analytics.service";
import { createDraft } from "../release.service";

const PACKAGE_NAME = "com.demo.analytics";

/**
 * 构造带 IP 与 UA 的测试请求。
 * @param path 请求路径
 * @param ip 客户端 IP
 * @returns Request
 */
function makeRequest(path: string, ip = "203.0.113.10"): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { "user-agent": "Mozilla/5.0 AnalyticsTest", "x-real-ip": ip },
  });
}

/**
 * 创建测试用应用。
 * @param developerId 归属开发者
 * @returns 应用记录
 */
async function seedApp(developerId?: string) {
  return createApp({
    slug: `analytics-${Math.random().toString(36).slice(2, 8)}`,
    name: "统计测试",
    summary: "测试应用",
    type: "ANDROID",
    category: "工具",
    packageName: PACKAGE_NAME,
    developerId,
  });
}

describe("分析服务", () => {
  beforeEach(async () => {
    await prisma.analyticsEvent.deleteMany();
    await prisma.release.deleteMany();
    await prisma.app.deleteMany();
    await prisma.developer.deleteMany();
  });

  it("记录页面浏览并聚合 PV、渠道与应用排行", async () => {
    const app = await seedApp();

    await recordPageView({
      request: makeRequest("/apps?from=wechat", "203.0.113.11"),
      path: "/apps",
      appId: app.id,
      channel: "wechat",
    });
    // 同一访客短时间内重复上报应被去重
    await recordPageView({
      request: makeRequest("/apps?from=wechat", "203.0.113.11"),
      path: "/apps",
      appId: app.id,
      channel: "wechat",
    });

    const overview = await getAnalyticsOverview({ days: 7 });
    expect(overview.totals.pv).toBe(1);
    expect(overview.totals.uv).toBe(1);
    expect(overview.channels[0]?.name).toBe("wechat");
    expect(overview.topApps[0]?.id).toBe(app.id);
  });

  it("记录安装上报并区分首次安装与更新", async () => {
    const app = await seedApp();
    await createDraft({
      appId: app.id,
      packageName: PACKAGE_NAME,
      versionCode: 3,
      versionName: "1.0.3",
      minSdk: 24,
      signFingerprint: null,
      filePath: `apks/${app.id}/3.apk`,
      fileSize: 1024,
      sha256: "sha-3",
    });

    const matched = await recordInstall({
      request: makeRequest("/install-report", "203.0.113.12"),
      packageName: PACKAGE_NAME,
      versionCode: 3,
      installType: "update",
      deviceModel: "Pixel 8",
      osVersion: "Android 15",
    });
    expect(matched).toBe(true);

    const overview = await getAnalyticsOverview({ days: 7 });
    expect(overview.totals.installs).toBe(1);
    expect(overview.totals.updates).toBe(1);
    expect(overview.totals.newInstalls).toBe(0);
    expect(overview.devices[0]?.name).toBe("Pixel 8");
    expect(overview.systems[0]?.name).toBe("Android 15");
  });

  it("未知包名的安装上报不会写入", async () => {
    const matched = await recordInstall({
      request: makeRequest("/install-report", "203.0.113.13"),
      packageName: "com.unknown.app",
      versionCode: 1,
      installType: "install",
    });
    expect(matched).toBe(false);
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it("开发者统计只包含自己名下的应用", async () => {
    const developerA = await prisma.developer.create({
      data: { username: "dev-a", passwordHash: "x", displayName: "开发者 A" },
    });
    const developerB = await prisma.developer.create({
      data: { username: "dev-b", passwordHash: "x", displayName: "开发者 B" },
    });
    const appA = await seedApp(developerA.id);
    const appB = await prisma.app.create({
      data: {
        slug: "analytics-b",
        name: "B 应用",
        summary: "测试",
        type: "ANDROID",
        category: "工具",
        developerId: developerB.id,
      },
    });

    await prisma.analyticsEvent.createMany({
      data: [
        { type: "page_view", appId: appA.id, path: "/a", visitorId: "v1" },
        { type: "page_view", appId: appB.id, path: "/b", visitorId: "v2" },
      ],
    });

    const overview = await getAnalyticsOverview({ days: 7, developerId: developerA.id });
    expect(overview.totals.pv).toBe(1);
    expect(overview.topApps.map((app) => app.id)).toEqual([appA.id]);
  });
});
