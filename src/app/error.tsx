"use client";

import { useEffect } from "react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * 全局错误边界，展示通用失败提示并记录错误。
 * @param props.error 捕获到的异常
 * @param props.reset 重置边界、重新渲染的回调
 * @returns 错误提示界面
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面渲染失败", error);
  }, [error]);

  return (
    <div className="page-center page-shell py-16 text-center">
      <div className="flex flex-col items-center">
        <BrandLogo size={56} className="opacity-90" />
        <h1 className="mt-6 text-xl font-semibold tracking-tight sm:text-2xl">页面加载失败</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          {error.message || "发生了未预期的错误，请稍后重试。"}
        </p>
        <button type="button" onClick={reset} className="btn-primary mt-6">
          重新加载
        </button>
      </div>
    </div>
  );
}
