"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 清空操作日志按钮，二次确认后调用删除接口。
 * @returns 操作按钮
 */
export function ClearLogsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 确认后清空日志并刷新页面。
   * @returns 无
   */
  async function handleClear(): Promise<void> {
    if (!window.confirm("确定清空全部操作日志？该操作不可撤销。")) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/logs", { method: "DELETE" });
      if (!response.ok) {
        setError("清除失败，请稍后重试");
        return;
      }
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span> : null}
      <button
        type="button"
        onClick={handleClear}
        disabled={loading}
        className="btn-secondary min-h-9 px-4 py-2 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-300"
      >
        {loading ? "清除中…" : "清除日志"}
      </button>
    </div>
  );
}
