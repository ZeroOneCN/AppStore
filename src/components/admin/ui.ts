/** 后台表单共用样式 */

/** 输入框样式 */
export const inputClass =
  "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-neutral-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-indigo-500 dark:focus:bg-neutral-900 dark:focus:ring-indigo-500/20";

/** 字段标签样式 */
export const labelClass = "mb-1.5 flex items-center gap-1.5 text-sm font-medium";

/** 主按钮样式 */
export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";

/** 次要按钮样式 */
export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-neutral-200 px-3 py-2 text-sm transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800";

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
