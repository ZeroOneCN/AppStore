import { beforeEach, describe, expect, it } from "vitest";
import { getEnv, resetEnvCache } from "../env";

/** 测试基线环境变量 */
const BASE_ENV: Record<string, string> = {
  BASE_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "file:../data/test.db",
  STORAGE_DIR: "./storage",
  DOWNLOAD_SIGN_SECRET: "s".repeat(32),
  SESSION_SECRET: "t".repeat(32),
  NEXT_PUBLIC_SITE_NAME: "测试仓库",
};

describe("getEnv", () => {
  beforeEach(() => {
    resetEnvCache();
    for (const [key, value] of Object.entries(BASE_ENV)) process.env[key] = value;
    delete process.env.MAX_APK_MB;
  });

  it("读取基线配置并应用默认值", () => {
    const env = getEnv();
    expect(env.BASE_URL).toBe("http://127.0.0.1:3000");
    expect(env.MAX_APK_MB).toBe(200);
    expect(env.STORAGE_DIR).toBe("./storage");
  });

  it("数值型配置支持字符串转换", () => {
    process.env.MAX_APK_MB = "512";
    resetEnvCache();
    expect(getEnv().MAX_APK_MB).toBe(512);
  });

  it("缺少签名密钥时报错并指出字段", () => {
    delete process.env.DOWNLOAD_SIGN_SECRET;
    resetEnvCache();
    expect(() => getEnv()).toThrow(/DOWNLOAD_SIGN_SECRET/);
  });

  it("BASE_URL 非法时报错", () => {
    process.env.BASE_URL = "not-a-url";
    resetEnvCache();
    expect(() => getEnv()).toThrow(/BASE_URL/);
  });
});
