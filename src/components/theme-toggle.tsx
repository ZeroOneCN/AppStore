"use client";

import { useSyncExternalStore } from "react";

/** 外观偏好 */
type Theme = "system" | "light" | "dark";

/** 偏好对应的按钮文案 */
const LABEL: Record<Theme, string> = {
  system: "跟随系统",
  light: "浅色",
  dark: "深色",
};

/** 偏好变化事件名，用于同页多按钮同步 */
const THEME_EVENT = "appstore-theme-change";

/**
 * 按偏好切换 html 根节点的 dark 类。
 * @param theme 外观偏好
 * @returns 无
 */
function applyTheme(theme: Theme): void {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/**
 * 读取本地保存的外观偏好。
 * @returns 外观偏好，未设置时为跟随系统
 */
function readTheme(): Theme {
  const saved = window.localStorage.getItem("theme");
  return saved === "light" || saved === "dark" ? saved : "system";
}

/**
 * 订阅外观偏好变化。
 * @param callback 变化回调
 * @returns 取消订阅函数
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

/**
 * 外观切换按钮：跟随系统 → 浅色 → 深色 循环。
 * @returns 切换按钮
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);

  /**
   * 切换到下一个外观偏好并持久化。
   * @returns 无
   */
  function cycle(): void {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    window.localStorage.setItem("theme", next);
    applyTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`当前外观：${LABEL[theme]}，点击切换`}
      className="rounded-full border border-black/10 px-2.5 py-1.5 text-[12px] text-neutral-600 transition hover:bg-white/70 dark:border-white/12 dark:text-neutral-300 dark:hover:bg-white/10"
    >
      {LABEL[theme]}
    </button>
  );
}
