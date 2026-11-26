"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DownloadButton } from "@/components/download-button";
import { checkApkFile } from "@/lib/apk-file";
import { formatBytes, formatDateTime } from "@/lib/format";
import { HelpTip } from "./help-tip";
import type { AdminReleaseData } from "./types";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass } from "./ui";

/** 版本状态文案 */
const STATUS_LABEL: Record<AdminReleaseData["status"], string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

/** 版本状态样式 */
const STATUS_STYLE: Record<AdminReleaseData["status"], string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  PUBLISHED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  ARCHIVED: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

/** 上传成功响应的关键字段 */
interface UploadResponse {
  parsed?: { packageName?: string; versionName?: string; versionCode?: number };
}

/** 版本操作类型 */
type ReleaseAction = "publish" | "set-current" | "archive";

/**
 * 版本管理：APK 上传（含进度）、版本列表与发布/回滚/归档操作。
 * @param props.appId 应用 ID
 * @param props.appType 应用类型
 * @param props.releases 版本列表
 * @param props.apiBase 接口前缀，默认管理员接口
 * @param props.autoPublish 上传成功后是否立即发布为当前版本
 * @param props.showDownload 是否在版本行展示下载按钮
 * @returns 版本管理界面
 */
export function ReleaseManager({
  appId,
  appType,
  releases,
  apiBase = "/api/admin",
  autoPublish = false,
  showDownload = false,
}: {
  appId: string;
  appType: "ANDROID" | "WEB";
  releases: AdminReleaseData[];
  apiBase?: string;
  autoPublish?: boolean;
  showDownload?: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  /**
   * 以二进制流上传 APK 并展示实时进度；上传前先校验文件完整性。
   * @returns 无
   */
  async function handleUpload(): Promise<void> {
    if (!file) {
      setError("请先选择 APK 文件");
      return;
    }
    const invalid = await checkApkFile(file);
    if (invalid) {
      // 清空已选文件并重置输入框，避免继续使用可能已过期的文件快照
      setError(invalid);
      setFile(null);
      setFileInputKey((key) => key + 1);
      return;
    }
    setUploading(true);
    setProgress(0);
    setError(null);
    setNotice(null);

    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({ filename: file.name });
    xhr.open("POST", `${apiBase}/apps/${appId}/releases?${query.toString()}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("X-Version-Changelog", encodeURIComponent(changelog));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        const parsed = (data as UploadResponse | null)?.parsed;
        if (autoPublish) {
          setNotice(
            parsed?.versionName
              ? `上传成功：${parsed.packageName ?? ""} v${parsed.versionName}（${parsed.versionCode ?? ""}），已自动发布为当前版本`
              : "上传成功，已自动发布为当前版本",
          );
        } else {
          setNotice(
            parsed?.versionName
              ? `上传成功：${parsed.packageName ?? ""} v${parsed.versionName}（${parsed.versionCode ?? ""}），草稿已创建，请点击「发布」上线`
              : "上传成功，版本草稿已创建，请点击「发布」上线",
          );
        }
        setFile(null);
        setChangelog("");
        setFileInputKey((key) => key + 1);
        setProgress(100);
        router.refresh();
      } else {
        setError(errorMessageOf(data, `上传失败（HTTP ${xhr.status}），请检查文件后重试`));
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("上传失败：网络中断或连接被重置");
    };

    xhr.send(file);
  }

  /**
   * 删除历史版本（当前版本禁止删除）。
   * @param releaseId 版本 ID
   * @param versionName 版本名称，用于确认提示
   * @returns 无
   */
  async function handleDelete(releaseId: string, versionName: string): Promise<void> {
    if (!window.confirm(`确定删除 v${versionName}？安装包文件会一并删除，且不可恢复。`)) return;

    setActing(`${releaseId}:delete`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/releases/${releaseId}`, { method: "DELETE" });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setError(errorMessageOf(data, "删除失败，请稍后重试"));
        return;
      }
      setNotice("已删除该版本");
      router.refresh();
    } catch {
      setError("网络异常，删除失败");
    } finally {
      setActing(null);
    }
  }

  /**
   * 执行发布、设为当前或归档操作。
   * @param releaseId 版本 ID
   * @param action 操作类型
   * @returns 无
   */
  async function runAction(releaseId: string, action: ReleaseAction): Promise<void> {
    if (action === "archive" && !window.confirm("归档后该版本不能再设为当前版本，历史下载链接仍有效。确定归档？")) {
      return;
    }

    setActing(`${releaseId}:${action}`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`${apiBase}/releases/${releaseId}/${action}`, { method: "POST" });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "操作失败，请稍后重试"));
        return;
      }
      setNotice(
        action === "publish" ? "已发布并设为当前版本" : action === "set-current" ? "已切换为当前版本" : "已归档该版本",
      );
      router.refresh();
    } catch {
      setError("网络异常，操作失败");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-4">
      {appType === "ANDROID" ? (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <h3 className="text-sm font-semibold">上传新版本 APK</h3>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            APK 会边上传边解析，包名必须与当前应用一致；版本号重复会被拒绝。
            {autoPublish ? "上传成功后自动发布为当前版本。" : "上传后先成为草稿。"}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="apk-file" className={labelClass}>
                APK 文件
              </label>
              <input
                key={fileInputKey}
                id="apk-file"
                type="file"
                accept=".apk,application/vnd.android.package-archive"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="block w-full cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white dark:border-neutral-700 dark:bg-neutral-950 dark:file:bg-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="changelog" className={labelClass}>
                更新日志
                <HelpTip text="展示在详情页与客户端更新弹窗，支持换行。" />
              </label>
              <textarea
                id="changelog"
                rows={2}
                maxLength={2000}
                value={changelog}
                onChange={(event) => setChangelog(event.target.value)}
                className={inputClass}
                placeholder="例如：修复导入崩溃，优化列表加载"
              />
            </div>
          </div>

          {uploading ? (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                正在上传并解析… {progress}%
              </p>
            </div>
          ) : null}

          <button type="button" onClick={() => void handleUpload()} disabled={uploading} className={`${primaryButtonClass} mt-3`}>
            {uploading ? "上传中…" : "上传并解析"}
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
          网页作品无需上传安装包，更新方式为直接修改访问链接。
        </p>
      )}

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">版本列表</h3>
        {releases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-400 dark:border-neutral-700">
            暂无版本
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
            {releases.map((release) => (
              <li key={release.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">v{release.versionName}</span>
                    <span className="text-xs text-neutral-400">（{release.versionCode}）</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[release.status]}`}>
                      {STATUS_LABEL[release.status]}
                    </span>
                    {release.isCurrent ? (
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                        当前版本
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatBytes(release.fileSize)} ·{" "}
                    {release.publishedAt
                      ? `发布于 ${formatDateTime(release.publishedAt)}`
                      : `创建于 ${formatDateTime(release.createdAt)}`}
                  </p>
                  {release.changelog ? (
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-neutral-500 dark:text-neutral-400">
                      {release.changelog}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {showDownload && release.status !== "DRAFT" ? (
                    <DownloadButton releaseId={release.id} label="下载" variant="ghost" />
                  ) : null}

                  {release.status === "DRAFT" ? (
                    <button
                      type="button"
                      onClick={() => void runAction(release.id, "publish")}
                      disabled={acting !== null}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                    >
                      {acting === `${release.id}:publish` ? "发布中…" : "发布"}
                    </button>
                  ) : null}

                  {release.status === "PUBLISHED" && !release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void runAction(release.id, "set-current")}
                      disabled={acting !== null}
                      className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                    >
                      {acting === `${release.id}:set-current` ? "切换中…" : "设为当前"}
                    </button>
                  ) : null}

                  {release.status !== "ARCHIVED" && !release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void runAction(release.id, "archive")}
                      disabled={acting !== null}
                      className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    >
                      {acting === `${release.id}:archive` ? "归档中…" : "归档"}
                    </button>
                  ) : null}

                  {!release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(release.id, release.versionName)}
                      disabled={acting !== null}
                      className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      {acting === `${release.id}:delete` ? "删除中…" : "删除"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
