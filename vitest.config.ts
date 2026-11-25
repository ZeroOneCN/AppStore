import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 集成测试共用同一个 SQLite 测试库，串行执行避免相互干扰
    fileParallelism: false,
    globalSetup: ["./tests/global-setup.ts"],
    env: {
      BASE_URL: "http://127.0.0.1:3000",
      DATABASE_URL: "file:../data/test.db",
      STORAGE_DIR: "./storage",
      DOWNLOAD_SIGN_SECRET: "s".repeat(32),
      SESSION_SECRET: "t".repeat(32),
    },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
