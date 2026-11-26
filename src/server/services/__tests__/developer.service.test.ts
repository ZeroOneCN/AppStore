import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../db";
import { verifyPassword } from "../auth.service";
import {
  assertDeveloperApp,
  changeDeveloperPassword,
  createDeveloper,
  createDeveloperApp,
  listDeveloperApps,
  listDevelopers,
  resetDeveloperPassword,
  setDeveloperStatus,
  updateDeveloperApp,
} from "../developer.service";

/** 开发者基础输入 */
const BASE = { username: "alice", displayName: "爱丽丝", password: "secret-123" };

describe("开发者服务", () => {
  beforeEach(async () => {
    await prisma.release.deleteMany();
    await prisma.app.deleteMany();
    await prisma.developer.deleteMany();
  });

  it("创建开发者并拒绝重名与弱密码", async () => {
    const developer = await createDeveloper(BASE);
    expect(developer.username).toBe("alice");
    expect(developer.status).toBe("ACTIVE");

    await expect(createDeveloper(BASE)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(createDeveloper({ ...BASE, username: "bob", password: "short" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
    await expect(createDeveloper({ ...BASE, username: "a" })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("列表返回应用数量并可启停账号", async () => {
    const developer = await createDeveloper(BASE);
    await createDeveloperApp(developer.id, {
      slug: "notes",
      name: "记事本",
      summary: "轻量本地笔记",
      type: "ANDROID",
      category: "工具",
      packageName: "com.demo.notes",
    });

    const items = await listDevelopers();
    expect(items).toHaveLength(1);
    expect(items[0]?.appCount).toBe(1);

    const disabled = await setDeveloperStatus(developer.id, "DISABLED");
    expect(disabled.status).toBe("DISABLED");
    await expect(setDeveloperStatus(developer.id, "DELETED")).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
    });
  });

  it("重置密码与自行改密生效，错误当前密码被拒绝", async () => {
    const developer = await createDeveloper(BASE);

    await resetDeveloperPassword(developer.id, "reset-1234");
    const afterReset = await prisma.developer.findUniqueOrThrow({ where: { id: developer.id } });
    expect(await verifyPassword("reset-1234", afterReset.passwordHash)).toBe(true);

    await expect(
      changeDeveloperPassword(developer.id, "wrong-0000", "next-1234"),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      changeDeveloperPassword(developer.id, "reset-1234", "reset-1234"),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });

    await changeDeveloperPassword(developer.id, "reset-1234", "next-1234");
    const afterChange = await prisma.developer.findUniqueOrThrow({ where: { id: developer.id } });
    expect(await verifyPassword("next-1234", afterChange.passwordHash)).toBe(true);
  });

  it("开发者只能访问与更新自己的应用", async () => {
    const alice = await createDeveloper(BASE);
    const bob = await createDeveloper({ ...BASE, username: "bob" });

    const app = await createDeveloperApp(alice.id, {
      slug: "alice-app",
      name: "爱丽丝应用",
      summary: "归属校验",
      type: "ANDROID",
      category: "工具",
      packageName: "com.demo.alice",
    });
    expect(app.developerId).toBe(alice.id);
    expect(app.visibility).toBe("PUBLIC");

    await expect(assertDeveloperApp(app.id, bob.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateDeveloperApp(bob.id, app.id, { summary: "越权修改" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const updated = await updateDeveloperApp(alice.id, app.id, { summary: "已更新简介" });
    expect(updated.summary).toBe("已更新简介");
    expect(updated.developerId).toBe(alice.id);

    const apps = await listDeveloperApps(alice.id);
    expect(apps.map((item) => item.id)).toEqual([app.id]);
    expect(apps[0]?.developer?.username).toBe("alice");
  });
});
