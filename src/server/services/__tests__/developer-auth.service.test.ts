import { beforeEach, describe, expect, it, vi } from "vitest";

/** 用内存桩替代 Prisma，避免单测依赖真实数据库 */
vi.mock("../../db", () => ({
  prisma: {
    developer: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../../db";
import { resetEnvCache } from "../../infra/env";
import { AppError } from "../../infra/errors";
import { createSessionToken, hashPassword } from "../auth.service";
import {
  createDeveloperSessionToken,
  developerLogin,
  resetDeveloperLoginRateLimit,
  verifyDeveloperSessionToken,
} from "../developer-auth.service";
import { verifySessionToken } from "../auth.service";

const ENV: Record<string, string> = {
  BASE_URL: "http://127.0.0.1:3000",
  DATABASE_URL: "file:../data/test.db",
  STORAGE_DIR: "./storage",
  DOWNLOAD_SIGN_SECRET: "s".repeat(32),
  SESSION_SECRET: "t".repeat(32),
};

const mockedFindUnique = vi.mocked(prisma.developer.findUnique);

describe("开发者会话", () => {
  beforeEach(() => {
    resetEnvCache();
    for (const [key, value] of Object.entries(ENV)) process.env[key] = value;
    resetDeveloperLoginRateLimit();
    mockedFindUnique.mockReset();
  });

  it("令牌载荷包含开发者角色并可通过校验", async () => {
    const token = await createDeveloperSessionToken({ id: "dev_1", username: "alice" });
    const payload = await verifyDeveloperSessionToken(token);
    expect(payload).toEqual({ sub: "dev_1", username: "alice", role: "developer" });
  });

  it("管理员令牌不能通过开发者校验", async () => {
    const adminToken = await createSessionToken("admin");
    await expect(verifyDeveloperSessionToken(adminToken)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("开发者令牌不能通过管理员校验", async () => {
    const devToken = await createDeveloperSessionToken({ id: "dev_1", username: "alice" });
    await expect(verifySessionToken(devToken)).rejects.toBeInstanceOf(AppError);
  });

  it("登录成功返回令牌，停用账号被拒绝", async () => {
    const passwordHash = await hashPassword("secret-123");
    mockedFindUnique.mockResolvedValue({
      id: "dev_1",
      username: "alice",
      displayName: "爱丽丝",
      passwordHash,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const result = await developerLogin("alice", "secret-123", "127.0.0.1");
    expect(result.developer.username).toBe("alice");
    const payload = await verifyDeveloperSessionToken(result.token);
    expect(payload.sub).toBe("dev_1");

    mockedFindUnique.mockResolvedValue({
      id: "dev_2",
      username: "bob",
      displayName: "",
      passwordHash,
      status: "DISABLED",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    await expect(developerLogin("bob", "secret-123", "127.0.0.1")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("连续失败后触发限流", async () => {
    mockedFindUnique.mockResolvedValue(null);

    for (let index = 0; index < 5; index += 1) {
      await expect(developerLogin("alice", "wrong", "10.0.0.1")).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    await expect(developerLogin("alice", "wrong", "10.0.0.1")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
