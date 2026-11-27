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
  ariaLabel,
}: {
  releaseId: string;
  label?: string;
  className?: string;
  variant?: "primary" | "ghost";
  ariaLabel?: string;
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

      // 下载为附件响应，页面本身不会跳走；透传渠道参数便于统计下载来源
      const pageParams = new URLSearchParams(window.location.search);
      const channel = pageParams.get("from") ?? pageParams.get("utm_source");
      const target = channel
        ? `${url}${url.includes("?") ? "&" : "?"}from=${encodeURIComponent(channel)}`
        : url;
      window.location.assign(target);
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
        aria-label={ariaLabel}
        className={`${
          variant === "ghost"
            ? "inline-flex min-h-9 min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition duration-200 hover:border-brand/30 hover:bg-white hover:text-brand active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            : "btn-primary"
        } ${className}`}
      >
        {loading ? (
          <svg aria-hidden viewBox="0 0 20 20" fill="none" className={variant === "ghost" ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"}>
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
            <path d="M17 10a7 7 0 0 0-7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="currentColor"
            className={variant === "ghost" ? "h-3.5 w-3.5" : "h-4 w-4"}
          >
            <path d="M10 2a1 1 0 0 1 1 1v7.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4a1 1 0 1 1 1.414-1.414L9 10.586V3a1 1 0 0 1 1-1Z" />
            <path d="M3 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z" />
          </svg>
        )}
        {loading ? "获取中…" : label}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
