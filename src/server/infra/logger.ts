type LogLevel = "info" | "warn" | "error";

/** 需要脱敏的字段名匹配规则 */
const SENSITIVE_KEY = /password|passwd|token|secret|signature|\bsig\b|cookie|authorization/i;

/**
 * 递归脱敏对象中的敏感字段，避免密码、令牌、签名密钥进入日志。
 * @param value 任意日志元数据
 * @param depth 当前递归深度，超过 3 层直接截断
 * @returns 脱敏后的副本
 */
function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[depth-limit]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(item, depth + 1);
  }
  return result;
}

/**
 * 输出单行结构化日志。
 * @param level 日志级别
 * @param message 日志正文
 * @param meta 附加元数据，会被脱敏
 * @returns 无
 */
function write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: sanitize(meta) } : {}),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  /** 记录普通信息 */
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  /** 记录可恢复的异常情况 */
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  /** 记录需要人工关注的错误 */
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
