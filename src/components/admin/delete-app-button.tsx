"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessageOf } from "./ui";

/**
 * 删除应用按钮，二次确认后删除并返回列表。
 * @param props.appId 应用 ID
 * @param props.appName 应用名称，用于确认提示
 * @returns 删除控件
 */
export function DeleteAppButton({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 确认后调用删除接口。
   * @returns 无
   */
  async function handleDelete(): Promise<void> {
    const confirmed = window.confirm(
      `确定删除「${appName}」？该操作会删除应用、全部版本记录与磁盘上的 APK、图标、截图，且不可恢复。`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/apps/${appId}`, { method: "DELETE" });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setError(errorMessageOf(data, "删除失败，请稍后重试"));
        return;
      }
      router.push("/admin/apps");
      router.refresh();
    } catch {
      setError("网络异常，删除失败");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleDelete()}
        disabled={deleting}
        className="rounded-xl border border-rose-200 px-3.5 py-2 text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
      >
        {deleting ? "删除中…" : "删除应用"}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
