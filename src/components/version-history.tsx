"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadButton } from "@/components/download-button";
import { formatBytes, formatDateTime } from "@/lib/format";

/** 历史版本条目 */
export interface VersionHistoryItem {
  id: string;
  versionName: string;
  versionCode: number;
  status: string;
  changelog: string;
  fileSize: number;
  sha256: string;
  minSdk: number | null;
  publishedAt: string | null;
}

/** 版本列表接口返回的条目 */
interface RemoteVersionItem {
  versionName?: string;
  versionCode?: number;
  changelog?: string;
  fileSize?: number;
  publishedAt?: string | null;
}

/**
 * 历史版本列表：点击版本查看更新日志、包信息与截图。
 * @param props.slug 应用访问标识
 * @param props.versions 服务端渲染的版本列表
 * @param props.currentVersionCode 当前版本号
 * @param props.screenshots 应用截图地址
 * @returns 版本列表与会话弹层
 */
export function VersionHistory({
  slug,
  versions,
  currentVersionCode,
  screenshots,
}: {
  slug: string;
  versions: VersionHistoryItem[];
  currentVersionCode?: number;
  screenshots: string[];
}) {
  const [items, setItems] = useState(versions);
  const [activeCode, setActiveCode] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const active = items.find((item) => item.versionCode === activeCode) ?? null;

  /**
   * 打开指定版本详情；首次打开时补充接口中的更新日志与包大小。
   * @param versionCode 版本号
   * @returns 无
   */
  const open = useCallback(
    async (versionCode: number): Promise<void> => {
      setActiveCode(versionCode);
      if (loaded) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/public/apps/${slug}/releases`);
        if (response.ok) {
          const data: unknown = await response.json();
          const list =
            data && typeof data === "object" && "items" in data
              ? ((data as { items?: RemoteVersionItem[] }).items ?? [])
              : [];
          setItems((previous) =>
            previous.map((item) => {
              const remote = list.find((entry) => entry.versionCode === item.versionCode);
              if (!remote) return item;
              return {
                ...item,
                changelog: remote.changelog ?? item.changelog,
                fileSize: remote.fileSize ?? item.fileSize,
                publishedAt: remote.publishedAt ?? item.publishedAt,
              };
            }),
          );
        }
      } catch {
        // 接口不可用时仍展示服务端已有信息
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    },
    [loaded, slug],
  );

  /**
   * 关闭全部弹层。
   * @returns 无
   */
  const close = useCallback((): void => {
    setActiveCode(null);
    setPreview(null);
  }, []);

  useEffect(() => {
    if (activeCode === null) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (preview) setPreview(null);
      else setActiveCode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeCode, preview]);

  return (
    <>
      <ul className="mt-2 divide-y divide-black/[0.05] text-sm dark:divide-white/[0.08]">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => open(item.versionCode)}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2.5 text-left transition hover:text-brand"
              aria-label={`查看 v${item.versionName} 版本详情`}
            >
              <span className="shrink-0 font-medium">v{item.versionName}</span>
              <span className="shrink-0 text-xs text-neutral-400">（{item.versionCode}）</span>
              {item.versionCode === currentVersionCode ? <span className="chip shrink-0">当前</span> : null}
              {item.status === "ARCHIVED" ? <span className="chip shrink-0">已归档</span> : null}
              <span className="ml-auto hidden shrink-0 text-xs text-neutral-500 sm:inline dark:text-neutral-400">
                {formatDateTime(item.publishedAt)}
              </span>
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-neutral-300 transition group-hover:text-brand"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <DownloadButton
              releaseId={item.id}
              label="下载"
              variant="ghost"
              ariaLabel={`下载 v${item.versionName}`}
            />
          </li>
        ))}
      </ul>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              {active ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-6"
          role="presentation"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`v${active.versionName} 版本详情`}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-[22px] bg-white p-5 shadow-2xl sm:rounded-[22px] sm:p-7 dark:bg-[#141417]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight">v{active.versionName}</h3>
                  <span className="text-xs text-neutral-400">（{active.versionCode}）</span>
                  {active.versionCode === currentVersionCode ? <span className="chip">当前版本</span> : null}
                </div>
                <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {[
                    active.publishedAt ? `发布于 ${formatDateTime(active.publishedAt)}` : null,
                    active.fileSize > 0 ? formatBytes(active.fileSize) : null,
                    active.minSdk ? `最低 Android API ${active.minSdk}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                autoFocus
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.05] text-neutral-500 transition hover:bg-black/[0.09] hover:text-neutral-800 dark:bg-white/10 dark:text-neutral-300"
                aria-label="关闭"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            {screenshots.length > 0 ? (
              <div className="mt-5">
                <p className="text-sm font-semibold">应用截图</p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {screenshots.map((image) => (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setPreview(image)}
                      className="shrink-0 overflow-hidden rounded-xl border border-black/[0.06] transition hover:opacity-90 dark:border-white/10"
                      aria-label="查看大图"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image} alt="" className="h-52 w-auto object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5">
              <p className="text-sm font-semibold">更新日志</p>
              {loading ? (
                <p className="mt-2 text-sm text-neutral-400">正在加载版本信息…</p>
              ) : (
                <p className="mt-2 whitespace-pre-line text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                  {active.changelog || "该版本未填写更新日志"}
                </p>
              )}
            </div>

            {active.sha256 ? (
              <div className="mt-5">
                <p className="text-[11px] text-neutral-400">SHA-256</p>
                <p className="mt-1 break-all font-mono text-[11px] leading-5 text-neutral-500 dark:text-neutral-400">
                  {active.sha256}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <DownloadButton
                releaseId={active.id}
                label="下载此版本"
                ariaLabel={`下载 v${active.versionName}`}
                className="w-full"
              />
              <button type="button" onClick={close} className="btn-secondary w-full sm:w-32">
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="presentation"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="应用截图" className="max-h-full max-w-full object-contain" />
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="关闭大图"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      ) : null}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
