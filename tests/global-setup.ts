import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * 测试全局初始化：重建独立的 SQLite 测试库，避免污染开发数据。
 * @returns 无
 */
export default function setup(): void {
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.rmSync(path.join(dataDir, "test.db"), { force: true });

  execSync("npx prisma db push --skip-generate --force-reset", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:../data/test.db" },
  });
}
