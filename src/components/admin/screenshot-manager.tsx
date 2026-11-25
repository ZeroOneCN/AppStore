"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessageOf, secondaryButtonClass } from "./ui";

/**
 * 截图管理：上传与删除。
 * @param props.appId 应用 ID
 * @param props.screenshots 当前截图地址
 * @returns 截图列表与上传控件
 */
export function ScreenshotManager({ appId, screenshots }: { appId: string; screenshots: string[] }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 依次上传所选截图。
   * @param files 用户选择的图片列表
   * @returns 无
   */
  async function handleFiles(files: File[]): Promise<void> {
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setError(`「${file.name}」超过 5MB，已跳过`);
          continue;
        }
        if (!file.type.startsWith("image/")) {
          setError(`「${file.name}」不是图片，已跳过`);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch(`/api/admin/apps/${appId}/screenshots`, {
          method: "POST",
          body: formData,
        });
        if (!response.ok) {
          const data: unknown = await response.json().catch(() => null);
          setError(errorMessageOf(data, `「${file.name}」上传失败`));
        }
      }
      router.refresh();
    } catch {
      setError("网络异常，截图上传失败");
    } finally {
      setUploading(false);
    }
  }

  /**
   * 删除指定索引的截图。
   * @param index 截图索引
   * @returns 无
   */
  async function handleDelete(index: number): Promise<void> {
    if (!window.confirm("确定删除这张截图？删除后不可恢复。")) return;
    setError(null);
    setDeletingIndex(index);
    try {
      const response = await fetch(`/api/admin/apps/${appId}/screenshots?index=${index}`, {
        method: "DELETE",
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "删除截图失败"));
        return;
      }
      router.refresh();
    } catch {
      setError("网络异常，删除截图失败");
    } finally {
      setDeletingIndex(null);
    }
  }

  return (
    <div className="space-y-3">
      {screenshots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-400 dark:border-neutral-700">
          暂无截图
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {screenshots.map((src, index) => (
            <div
              key={src}
              className="group relative aspect-[9/16] overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <Image
                src={src}
                alt={`截图 ${index + 1}`}
                fill
                unoptimized
                sizes="150px"
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => void handleDelete(index)}
                disabled={deletingIndex === index}
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] text-white transition hover:bg-rose-600 disabled:opacity-60"
              >
                {deletingIndex === index ? "删除中" : "删除"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="screenshot-files"
          className={`${secondaryButtonClass} w-fit cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? "上传中…" : "添加截图"}
        </label>
        <input
          id="screenshot-files"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void handleFiles(files);
          }}
        />
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          单张不超过 5MB，可一次选择多张，按选择顺序追加
        </span>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
