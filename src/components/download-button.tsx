"use client";

import { useState } from "react";

/**
 * 下载按钮：点击时实时获取签名票据，再跳转到下载地址。
 * @param props.releaseId 版本 ID
 * @param props.className 额外样式
 * @param props.label 按钮文案，默认「下载 APK」
 * @param props.variant 视觉风格，primary 为主按钮，ghost 为列表内小按钮
 * @returns 下载按钮与错误提示
 */
export function DownloadButton({
  releaseId,
  label = "下载 APK",
  className = "",
  variant = "primary",
}: {
  releaseId: string;
  label?: string;
  className?: string;
  variant?: "primary" | "ghost";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取下载票据并触发浏览器下载。
   * @returns 无
   */
  async function handleDownload(): Promise<void> {
    setLoading(true);
    setError(null);
    let started = false;
    try {
      const response = await fetch(`/api/public/releases/${releaseId}/download-ticket`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "获取下载链接失败")
            : "获取下载链接失败";
        setError(message);
        return;
      }

      const url =
        payload && typeof payload === "object" && "url" in payload
          ? String((payload as { url: string }).url)
          : "";
      if (!url) {
        setError("下载链接无效，请稍后重试");
        return;
      }

      // 下载为附件响应，页面本身不会跳走
      window.location.assign(url);
      started = true;
      // 浏览器处理下载期间恢复按钮，避免一直停留在加载态
      setTimeout(() => setLoading(false), 1500);
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      if (!started) setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading}
        className={`${
          variant === "ghost"
            ? "rounded-lg border border-neutral-200 px-2.5 py-1 text-xs transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
            : "btn-primary"
        } ${className}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          fill="currentColor"
          className={variant === "ghost" ? "h-3.5 w-3.5" : "h-4 w-4"}
        >
          <path d="M10 2a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 10.586V3a1 1 0 0 1 1-1Z" />
          <path d="M3 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
        </svg>
        {loading ? "正在获取链接…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
