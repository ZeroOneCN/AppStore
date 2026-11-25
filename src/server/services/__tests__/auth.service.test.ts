import { beforeEach, describe, expect, it, vi } from "vitest";

/** 用内存桩替代 Prisma，避免单测依赖真实数据库 */
vi.mock("../../db", () => ({
  prisma: {
    adminUser: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../../db";
import { resetEnvCache } from "../../infra/env";
import { SESSION_TTL_SECONDS } from "../../infra/constants";
import { AppError } from "../../infra/errors";
import {
  createSessionToken,
  hashPassword,
  login,
  resetLoginRateLimit,
  verifyPassword,
  verifySessionToken,
} from "../auth.service";

const ENV: Record<string, string> = {
  BASE_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "file:../data/test.db",
  STORAGE_DIR: "./storage",
  DOWNLOAD_SIGN_SECRET: "s".repeat(32),
  SESSION_SECRET: "t".repeat(32),
};

describe("密码哈希", () => {
  it("哈希可通过校验，错误密码不通过", async () => {
    const hash = await hashPassword("secret-123");
    expect(hash).not.toBe("secret-123");
    expect(await verifyPassword("secret-123", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("会话令牌", () => {
  beforeEach(() => {
    resetEnvCache();
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
  });

  it("签发后可校验出用户名", async () => {
    const token = await createSessionToken("admin");
    const payload = await verifySessionToken(token);
    expect(payload.username).toBe("admin");
  });

  it("篡改后的令牌校验失败", async () => {
    const token = await createSessionToken("admin");
    const tampered = `${token.slice(0, -2)}aa`;
    await expect(verifySessionToken(tampered)).rejects.toBeInstanceOf(AppError);
  });

  it("过期令牌校验失败", async () => {
    const expired = await createSessionToken(
      "admin",
      Date.now() - (SESSION_TTL_SECONDS + 60) * 1000,
    );
    await expect(verifySessionToken(expired)).rejects.toBeInstanceOf(AppError);
  });
});

describe("登录限流", () => {
  const findUnique = vi.mocked(prisma.adminUser.findUnique);

  beforeEach(async () => {
    resetEnvCache();
    resetLoginRateLimit();
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
    const passwordHash = await hashPassword("right-password");
    findUnique.mockResolvedValue({
      id: "u1",
      username: "admin",
      passwordHash,
      createdAt: new Date(),
    });
  });

  it("正确密码返回令牌", async () => {
    const token = await login("admin", "right-password", "1.1.1.1");
    expect((await verifySessionToken(token)).username).toBe("admin");
  });

  it("连续 5 次密码错误后第 6 次返回 RATE_LIMITED", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(login("admin", "bad", "2.2.2.2")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    await expect(login("admin", "right-password", "2.2.2.2")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("不同客户端互不影响限流", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(login("admin", "bad", "3.3.3.3")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    const token = await login("admin", "right-password", "4.4.4.4");
    expect(token).toBeTruthy();
  });
});
