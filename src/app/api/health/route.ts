import { constants } from "node:fs";
import fs from "node:fs/promises";
import { prisma } from "@/server/db";
import { ensureStorageDirs, storageRoot } from "@/server/infra/paths";

/**
 * 健康检查：数据库连通性与存储目录可写，供监控与部署探活使用。
 * @returns 健康状态 JSON，异常时返回 503
 */
export async function GET(): Promise<Response> {
  const checks = { database: false, storage: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  try {
    ensureStorageDirs();
    await fs.access(storageRoot(), constants.W_OK);
    checks.storage = true;
  } catch {
    checks.storage = false;
  }

  const ok = checks.database && checks.storage;
  return Response.json(
    {
      status: ok ? "ok" : "degraded",
      checks,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
