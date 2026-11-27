import { PrismaClient } from "@prisma/client";

/**
 * 清理过期的分析事件，避免事件表无限增长。
 * 保留天数由 ANALYTICS_RETENTION_DAYS 控制，默认 180 天。
 */
const prisma = new PrismaClient();

const days = Number(process.env.ANALYTICS_RETENTION_DAYS ?? 180);
const retentionDays = Number.isFinite(days) && days >= 7 ? Math.floor(days) : 180;
const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

try {
  const result = await prisma.analyticsEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  console.log(
    `[analytics] 已清理 ${result.count} 条早于 ${cutoff.toISOString()} 的事件（保留 ${retentionDays} 天）`,
  );
} catch (error) {
  console.error("[analytics] 清理失败", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
