"use client";

import { useState } from "react";

/** 代码示例标签 */
export type CodeTab = {
  id: string;
  label: string;
  code: string;
};

/**
 * 多语言代码块：顶部语言切换与一键复制。
 * @param props.tabs 语言与代码内容
 * @param props.compact 紧凑模式，减少内边距与字号，用于首页等空间有限的位置
 * @returns 代码块组件
 */
export function CodeTabs({ tabs, compact = false }: { tabs: CodeTab[]; compact?: boolean }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [copied, setCopied] = useState(false);

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  /**
   * 复制当前示例代码。
   * @returns 无
   */
  async function handleCopy(): Promise<void> {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  if (!active) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-black/[0.08] bg-[#0b0d12] dark:border-white/10">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-2 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveId(tab.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] transition ${
                tab.id === active.id
                  ? "bg-white/12 text-white"
                  : "text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] text-neutral-400 transition hover:bg-white/[0.06] hover:text-neutral-200"
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      <pre
        className={`overflow-x-auto font-mono text-neutral-100 ${
          compact ? "px-3 py-2.5 text-[11.5px] leading-5" : "px-4 py-4 text-[12.5px] leading-6"
        }`}
      >
        <code>{active.code}</code>
      </pre>
    </div>
  );
}
