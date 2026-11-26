import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { createInviteCodes } from "../invite-code.service";
import { registerDeveloper, resetRegisterRateLimit } from "../registration.service";

/**
 * 直接写入后台注册模式，模拟管理员在后台保存设置。
 * @param mode 注册模式
 * @returns 无
 */
async function setMode(mode: "OFF" | "OPEN" | "INVITE"): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { id: 1 },
    update: { registrationMode: mode },
    create: { id: 1, registrationMode: mode },
  });
}

/** 基础注册信息 */
const BASE = { username: "reg-user", displayName: "注册用户", password: "secret-123" };

describe("开发者注册服务", () => {
  beforeEach(async () => {
    await prisma.inviteCode.deleteMany();
    await prisma.developer.deleteMany();
    resetRegisterRateLimit();
  });

  it("后台关闭注册时拒绝注册", async () => {
    await setMode("OFF");
    await expect(registerDeveloper(BASE, "ip-1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await prisma.developer.count()).toBe(0);
  });

  it("开放注册时无需邀请码，并校验用户名与密码", async () => {
    await setMode("OPEN");
    const developer = await registerDeveloper(BASE, "ip-2");
    expect(developer.username).toBe("reg-user");
    expect(developer.displayName).toBe("注册用户");

    await expect(registerDeveloper(BASE, "ip-2")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-2", password: "short" }, "ip-2"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-3" }, "ip-2"),
    ).resolves.toMatchObject({ username: "reg-user-3" });
  });

  it("邀请码注册：缺失、无效、过期均被拒绝，有效码仅能使用一次", async () => {
    await setMode("INVITE");

    await expect(registerDeveloper(BASE, "ip-3")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(
      registerDeveloper({ ...BASE, inviteCode: "APP-NOPE-NOPE" }, "ip-3"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const [valid] = await createInviteCodes({ count: 1, note: "测试", createdBy: "admin" });
    await registerDeveloper({ ...BASE, inviteCode: valid!.code }, "ip-3");

    const row = await prisma.inviteCode.findUnique({ where: { code: valid!.code } });
    expect(row?.usedBy).toBe("reg-user");
    expect(row?.usedAt).toBeTruthy();

    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-4", inviteCode: valid!.code }, "ip-3"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const [expired] = await createInviteCodes({
      count: 1,
      createdBy: "admin",
      expiresAt: new Date(Date.now() - 60_000),
    });
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-5", inviteCode: expired!.code }, "ip-3"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("注册模式以数据库后台设置为准", async () => {
    await setMode("OPEN");
    expect(await prisma.developer.count()).toBe(0);

    await setMode("OFF");
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-6" }, "ip-4"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await setMode("INVITE");
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-6" }, "ip-4"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    const [code] = await createInviteCodes({ count: 1, createdBy: "admin" });
    await expect(
      registerDeveloper({ ...BASE, username: "reg-user-6", inviteCode: code!.code }, "ip-4"),
    ).resolves.toMatchObject({ username: "reg-user-6" });
  });
});
