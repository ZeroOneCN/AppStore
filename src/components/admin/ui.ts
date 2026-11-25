/** 后台表单共用样式 */

/** 输入框样式（复用全局 Apple 风格令牌） */
export const inputClass = "input-apple";

/** 字段标签样式 */
export const labelClass = "mb-1.5 flex items-center gap-1.5 text-sm font-medium";

/** 主按钮样式 */
export const primaryButtonClass = "btn-primary";

/** 次要按钮样式 */
export const secondaryButtonClass = "btn-secondary";

/**
 * 从标准错误响应中提取可读信息，附带字段级校验详情。
 * @param payload 接口返回体
 * @param fallback 兜底文案
 * @returns 面向用户的错误描述
 */
export function errorMessageOf(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return fallback;
  const error = (payload as { error?: { code?: string; message?: string; details?: unknown } }).error;
  if (!error) return fallback;

  const code = typeof error.code === "string" ? error.code : "";
  const message = error.message || fallback;
  const prefix = code ? `【${code}】` : "";
  if (Array.isArray(error.details)) {
    const issues = error.details
      .slice(0, 3)
      .map((issue) => {
        if (!issue || typeof issue !== "object") return "";
        const item = issue as { path?: unknown; message?: unknown };
        const path = Array.isArray(item.path) ? item.path.join(".") : "";
        const detail = typeof item.message === "string" ? item.message : "";
        return path ? `${path}：${detail}` : detail;
      })
      .filter(Boolean);
    if (issues.length > 0) return `${prefix}${message}（${issues.join("；")}）`;
  }
  return `${prefix}${message}`;
}
