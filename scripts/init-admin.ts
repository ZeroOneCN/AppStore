import "dotenv/config";
import { prisma } from "../src/server/db";
import { getEnv } from "../src/server/infra/env";
import { hashPassword } from "../src/server/services/auth.service";

/**
 * 初始化（或重置）管理员账号。
 * 从 .env 读取 ADMIN_USERNAME / ADMIN_PASSWORD，幂等执行：账号已存在时仅更新密码哈希。
 */
async function main(): Promise<void> {
  const env = getEnv();
  if (!env.ADMIN_PASSWORD) {
    throw new Error("未设置 ADMIN_PASSWORD，请先在 .env 中补充后再执行");
  }

  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  const user = await prisma.adminUser.upsert({
    where: { username: env.ADMIN_USERNAME },
    create: { username: env.ADMIN_USERNAME, passwordHash },
    update: { passwordHash },
  });

  console.log(`管理员账号已就绪：${user.username}（初始化完成后可从 .env 删除 ADMIN_PASSWORD）`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
