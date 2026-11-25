"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

/**
 * 截图画廊：网格缩略图 + 点击放大预览，支持左右切换与 Esc 关闭。
 * @param props.images 截图地址列表
 * @param props.name 应用名称，用于替代文本
 * @returns 画廊元素
 */
export function ScreenshotGallery({ images, name }: { images: string[]; name: string }) {
  const [current, setCurrent] = useState<number | null>(null);

  /**
   * 切换到上一张。
   * @returns 无
   */
  const showPrev = useCallback(() => {
    setCurrent((index) => (index === null ? null : (index - 1 + images.length) % images.length));
  }, [images.length]);

  /**
   * 切换到下一张。
   * @returns 无
   */
  const showNext = useCallback(() => {
    setCurrent((index) => (index === null ? null : (index + 1) % images.length));
  }, [images.length]);

  // 预览打开时监听键盘操作
  useEffect(() => {
    if (current === null) return;
    /**
     * 键盘事件处理。
     * @param event 键盘事件
     * @returns 无
     */
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") setCurrent(null);
      if (event.key === "ArrowLeft") showPrev();
      if (event.key === "ArrowRight") showNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, showNext, showPrev]);

  if (images.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-neutral-300 py-10 text-sm text-neutral-400 dark:border-neutral-700">
        暂无截图
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {images.map((src, index) => (
          <button
            key={src}
            type="button"
            onClick={() => setCurrent(index)}
            className="relative aspect-[9/16] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 transition hover:border-indigo-300 dark:border-neutral-800 dark:bg-neutral-900"
            aria-label={`查看第 ${index + 1} 张截图`}
          >
            <Image
              src={src}
              alt={`${name} 截图 ${index + 1}`}
              fill
              unoptimized
              sizes="(max-width: 640px) 45vw, 200px"
              className="object-cover"
            />
          </button>
        ))}
      </div>

      {current !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} 截图预览`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setCurrent(null)}
        >
          <div
            className="relative h-[80vh] w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={images[current]}
              alt={`${name} 截图 ${current + 1}`}
              fill
              unoptimized
              sizes="90vw"
              className="object-contain"
            />
          </div>

          <button
            type="button"
            onClick={() => setCurrent(null)}
            className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-sm text-white transition hover:bg-white/25"
          >
            关闭
          </button>
          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrev();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-white transition hover:bg-white/25"
                aria-label="上一张"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/15 px-3 py-2 text-white transition hover:bg-white/25"
                aria-label="下一张"
              >
                ›
              </button>
            </>
          ) : null}
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-xs text-white">
            {current + 1} / {images.length}
          </span>
        </div>
      ) : null}
    </>
  );
}
