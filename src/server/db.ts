import { PrismaClient } from "@prisma/client";

/**
 * Prisma 客户端单例。
 * 开发环境下热更新会重复加载模块，挂到 globalThis 上避免连接数膨胀。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
