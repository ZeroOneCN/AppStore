"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** 排序选项 */
const SORT_OPTIONS = [
  { value: "recent", label: "最近发布" },
  { value: "name", label: "按名称" },
  { value: "downloads", label: "下载最多" },
] as const;

/** 类型筛选选项 */
const TYPE_OPTIONS = [
  { value: "", label: "全部" },
  { value: "ANDROID", label: "Android" },
  { value: "WEB", label: "网页" },
] as const;

/**
 * 应用墙筛选栏：关键词搜索（防抖）、类型、分类、标签与排序。
 * @param props.categories 可选分类
 * @param props.tags 可选标签
 * @returns 筛选控件
 */
export function FilterBar({ categories, tags }: { categories: string[]; tags: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentQuery = params.get("q") ?? "";
  const activeType = params.get("type") ?? "";
  const activeCategory = params.get("category") ?? "";
  const activeTag = params.get("tag") ?? "";
  const activeSort = params.get("sort") ?? "recent";

  const [query, setQuery] = useState(currentQuery);
  const [syncedQuery, setSyncedQuery] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 地址栏关键词被外部改变（清空筛选、前进后退）时同步输入框
  if (syncedQuery !== currentQuery) {
    setSyncedQuery(currentQuery);
    setQuery(currentQuery);
  }

  // 卸载时清理未触发的防抖任务
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  /**
   * 将补丁合并进当前查询串并替换地址，不产生历史记录。
   * @param patch 需要设置或清除的查询参数，空字符串表示删除
   * @returns 无
   */
  function applyPatch(patch: Record<string, string>): void {
    const next = new URLSearchParams(params.toString());
    // 切换其他筛选时保留输入框里尚未防抖提交的关键词
    if (!("q" in patch)) {
      const trimmed = query.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
    }
    Object.entries(patch).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    const search = next.toString();
    startTransition(() => {
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    });
  }

  /**
   * 搜索框输入，300 毫秒防抖后写入地址栏。
   * @param value 输入内容
   * @returns 无
   */
  function handleQueryChange(value: string): void {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyPatch({ q: value.trim() }), 300);
  }

  const hasFilters =
    Boolean(currentQuery) || Boolean(activeType) || Boolean(activeCategory) || Boolean(activeTag);

  return (
    <div className="card-apple p-3.5 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">搜索应用</span>
          <input
            type="search"
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="搜索应用名称或简介"
            className="w-full rounded-xl border border-transparent bg-black/[0.04] px-3.5 py-2.5 pr-9 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand/40 focus:bg-white focus:ring-4 focus:ring-brand/10 dark:bg-white/[0.06] dark:text-neutral-100 dark:focus:border-brand/50 dark:focus:bg-[#1c1c1e]"
          />
          {isPending ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand">…</span>
          ) : null}
        </label>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-black/[0.05] p-0.5 dark:bg-white/[0.08]">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => applyPatch({ type: option.value })}
                className={`rounded-[10px] px-3 py-1.5 text-xs font-medium transition ${
                  activeType === option.value
                    ? "bg-white text-neutral-900 shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <label className="sr-only" htmlFor="sort-select">
            排序方式
          </label>
          <select
            id="sort-select"
            value={activeSort}
            onChange={(event) => applyPatch({ sort: event.target.value === "recent" ? "" : event.target.value })}
            className="rounded-xl border border-black/[0.06] bg-white/70 px-2.5 py-2 text-xs text-neutral-700 outline-none transition hover:bg-white focus:border-brand/40 focus:ring-4 focus:ring-brand/10 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-neutral-400">分类</span>
        <Chip active={!activeCategory} onClick={() => applyPatch({ category: "" })}>
          全部
        </Chip>
        {categories.map((category) => (
          <Chip
            key={category}
            active={activeCategory === category}
            onClick={() => applyPatch({ category: activeCategory === category ? "" : category })}
          >
            {category}
          </Chip>
        ))}
      </div>

      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-neutral-400">标签</span>
          <Chip active={!activeTag} onClick={() => applyPatch({ tag: "" })}>
            全部
          </Chip>
          {tags.map((tag) => (
            <Chip
              key={tag}
              active={activeTag === tag}
              onClick={() => applyPatch({ tag: activeTag === tag ? "" : tag })}
            >
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}

      {hasFilters ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setQuery("");
              applyPatch({ q: "", type: "", category: "", tag: "", sort: "" });
            }}
            className="text-xs font-medium text-brand transition hover:text-brand-deep"
          >
            清空筛选
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * 筛选标签按钮。
 * @param props.active 是否为当前选中项
 * @param props.onClick 点击回调
 * @param props.children 文案
 * @returns 标签按钮
 */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs transition duration-200 ${
        active
          ? "bg-brand text-white shadow-[0_6px_16px_-10px_rgba(30,81,238,0.9)]"
          : "bg-black/[0.04] text-neutral-600 hover:bg-black/[0.07] dark:bg-white/[0.07] dark:text-neutral-300 dark:hover:bg-white/[0.12]"
      }`}
    >
      {children}
    </button>
  );
}
