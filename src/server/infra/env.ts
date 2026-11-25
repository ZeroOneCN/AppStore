import { z } from "zod";

/** 合法 URL 校验（兼容内网 IP + 端口） */
const urlLike = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "必须是合法的绝对 URL，例如 http://192.168.1.10:3000");

const envSchema = z.object({
  BASE_URL: urlLike,
  DATABASE_URL: z.string().min(1, "DATABASE_URL 不能为空"),
  STORAGE_DIR: z.string().min(1).default("./storage"),
  DOWNLOAD_SIGN_SECRET: z.string().min(16, "DOWNLOAD_SIGN_SECRET 至少 16 个字符"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET 至少 16 个字符"),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().optional(),
  MAX_APK_MB: z.coerce.number().int().positive().default(200),
  NEXT_PUBLIC_SITE_NAME: z.string().min(1).default("我的应用仓库"),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

/**
 * 读取并校验环境变量。
 * 采用惰性求值，避免构建期因变量缺失直接中断；真正的服务启动或首次使用时若配置有误会抛错。
 * @returns 强类型环境变量对象
 * @throws Error 当环境变量缺失或格式非法时抛出，包含具体字段与原因
 */
export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`环境变量配置无效：${detail}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * 清空环境变量缓存，仅用于单元测试中切换配置。
 * @returns 无
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
