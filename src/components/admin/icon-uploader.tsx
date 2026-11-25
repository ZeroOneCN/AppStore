"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessageOf, secondaryButtonClass } from "./ui";

/** 图标大小上限（与后端一致） */
const MAX_ICON_BYTES = 2 * 1024 * 1024;

/**
 * 应用图标上传组件。
 * @param props.appId 应用 ID
 * @param props.iconUrl 当前图标地址
 * @returns 图标预览与上传控件
 */
export function IconUploader({ appId, iconUrl }: { appId: string; iconUrl: string | null }) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 上传所选图标文件。
   * @param file 用户选择的图片
   * @returns 无
   */
  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (file.size > MAX_ICON_BYTES) {
      setError("图标不能超过 2MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("图标仅支持 PNG / JPG / WEBP");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`/api/admin/apps/${appId}/icon`, {
        method: "POST",
        body: formData,
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "图标上传失败"));
        return;
      }
      router.refresh();
    } catch {
      setError("网络异常，图标上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt="应用图标"
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-xl border border-neutral-200 bg-white object-cover dark:border-neutral-700"
          />
        ) : (
          <span className="grid h-16 w-16 place-items-center rounded-xl bg-neutral-100 text-xs text-neutral-400 dark:bg-neutral-800">
            无图标
          </span>
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="icon-file"
            className={`${secondaryButtonClass} cursor-pointer ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            {uploading ? "上传中…" : iconUrl ? "更换图标" : "上传图标"}
          </label>
          <input
            id="icon-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            PNG / JPG / WEBP，不超过 2MB，自动转为 512×512
          </span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
