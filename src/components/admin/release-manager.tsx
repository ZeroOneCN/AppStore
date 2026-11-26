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
  release?: { versionName?: string; versionCode?: number; status?: string };
  parsed?: { packageName?: string; versionName?: string; versionCode?: number };
  overwritten?: boolean;
}

/** 版本操作类型 */
type ReleaseAction = "publish" | "set-current" | "archive";

/** 列表操作按钮样式 */
const rowButtonClass =
  "rounded-lg border border-neutral-200 px-3 py-1.5 text-sm transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800";

/** 列表主操作按钮样式（发布/上线） */
const rowPrimaryButtonClass =
  "rounded-lg bg-indigo-600 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-60";

/**
 * 版本管理：当前版本概览、APK 上传（含覆盖与发布选项、进度）、待发布草稿与版本历史。
 * @param props.appId 应用 ID
 * @param props.appType 应用类型
 * @param props.releases 版本列表
 * @param props.apiBase 接口前缀，默认管理员接口
 * @param props.defaultPublish 上传后是否默认立即发布
 * @param props.showDownload 是否展示下载按钮
 * @returns 版本管理界面
 */
export function ReleaseManager({
  appId,
  appType,
  releases,
  apiBase = "/api/admin",
  defaultPublish = true,
  showDownload = false,
}: {
  appId: string;
  appType: "ANDROID" | "WEB";
  releases: AdminReleaseData[];
  apiBase?: string;
  defaultPublish?: boolean;
  showDownload?: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [publishAfterUpload, setPublishAfterUpload] = useState(defaultPublish);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const currentRelease = releases.find((release) => release.isCurrent) ?? null;
  const drafts = releases.filter((release) => release.status === "DRAFT");

  /**
   * 以二进制流上传 APK 并展示实时进度；上传前先校验文件完整性。
   * 通过查询参数提交覆盖与发布选项，服务端据此替换同版本号或创建草稿。
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

    const query = new URLSearchParams({
      filename: file.name,
      publish: publishAfterUpload ? "1" : "0",
    });
    if (overwrite) query.set("overwrite", "1");

    const xhr = new XMLHttpRequest();
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
        const payload = (data as UploadResponse | null) ?? undefined;
        const versionName = payload?.release?.versionName ?? payload?.parsed?.versionName;
        const versionCode = payload?.release?.versionCode ?? payload?.parsed?.versionCode;
        const label = versionName ? `v${versionName}（${versionCode ?? ""}）` : "新版本";
        const overwritten = payload?.overwritten ? "已覆盖 " : "已创建 ";

        if (publishAfterUpload) {
          setNotice(`${overwritten}${label}，并发布为当前版本`);
        } else {
          setNotice(
            payload?.release?.status === "PUBLISHED"
              ? `${overwritten}${label}，版本仍是已发布状态`
              : `${overwritten}${label} 草稿，可在上方「待发布草稿」一键发布`,
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
    <div className="space-y-5">
      {currentRelease ? (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-indigo-500 p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-indigo-100">当前线上版本</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">v{currentRelease.versionName}</p>
              <p className="mt-1 text-sm text-indigo-100">
                版本号 {currentRelease.versionCode} · {formatBytes(currentRelease.fileSize)}
                {currentRelease.publishedAt
                  ? ` · 发布于 ${formatDateTime(currentRelease.publishedAt)}`
                  : ""}
              </p>
            </div>
            {showDownload ? (
              <div className="shrink-0">
                <DownloadButton releaseId={currentRelease.id} label="下载当前版本" variant="ghost" />
              </div>
            ) : null}
          </div>
          {currentRelease.changelog ? (
            <p className="mt-3 whitespace-pre-line border-t border-white/20 pt-3 text-sm leading-6 text-indigo-50">
              {currentRelease.changelog}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-neutral-300 px-5 py-6 dark:border-neutral-700">
          <p className="text-sm font-medium">尚未发布任何版本</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            上传 APK 并勾选「上传后立即发布」，或先存为草稿再在「待发布草稿」中一键发布。
          </p>
        </div>
      )}

      {appType === "ANDROID" ? (
        <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">上传安装包</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">包名必须与应用记录一致</p>
          </div>

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
                <HelpTip text="展示在详情页与客户端更新弹窗，支持换行。覆盖同版本号时留空会保留原日志。" />
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

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
                className="mt-0.5 size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">覆盖同版本号</span>
                <span className="mt-0.5 block text-xs leading-4 text-neutral-500 dark:text-neutral-400">
                  版本号已存在时直接替换安装包与包信息，保留发布状态与下载统计。
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 px-3 py-2.5 dark:border-neutral-800">
              <input
                type="checkbox"
                checked={publishAfterUpload}
                onChange={(event) => setPublishAfterUpload(event.target.checked)}
                className="mt-0.5 size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">上传后立即发布</span>
                <span className="mt-0.5 block text-xs leading-4 text-neutral-500 dark:text-neutral-400">
                  勾选后直接设为当前线上版本；取消勾选则保存为草稿。
                </span>
              </span>
            </label>
          </div>

          {uploading ? (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                正在上传并解析… {progress}%
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleUpload()}
              disabled={uploading}
              className={`${primaryButtonClass} px-6 py-2.5`}
            >
              {uploading ? "上传中…" : publishAfterUpload ? "上传并发布" : "上传为草稿"}
            </button>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {overwrite ? "同版本号将被本次安装包替换" : "版本号重复会被拒绝（可勾选覆盖）"}
            </p>
          </div>
        </section>
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

      {drafts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            待发布草稿（{drafts.length}）
          </h3>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            草稿不会出现在前台，点击「立即发布」后才会设为当前版本并对外提供下载。
          </p>
          <ul className="mt-3 space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-3 dark:bg-neutral-900"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    v{draft.versionName}
                    <span className="ml-1.5 text-xs font-normal text-neutral-400">（{draft.versionCode}）</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {formatBytes(draft.fileSize)} · 创建于 {formatDateTime(draft.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runAction(draft.id, "publish")}
                  disabled={acting !== null}
                  className={`${rowPrimaryButtonClass} px-4 py-2`}
                >
                  {acting === `${draft.id}:publish` ? "发布中…" : "立即发布"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">版本历史（{releases.length}）</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">发布新版本会自动取消旧版本的当前标记</p>
        </div>
        {releases.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-400 dark:border-neutral-700">
            暂无版本
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
            {releases.map((release) => (
              <li key={release.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
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
                      className={rowPrimaryButtonClass}
                    >
                      {acting === `${release.id}:publish` ? "发布中…" : "发布"}
                    </button>
                  ) : null}

                  {release.status === "PUBLISHED" && !release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void runAction(release.id, "set-current")}
                      disabled={acting !== null}
                      className={rowButtonClass}
                    >
                      {acting === `${release.id}:set-current` ? "切换中…" : "设为当前"}
                    </button>
                  ) : null}

                  {release.status !== "ARCHIVED" && !release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void runAction(release.id, "archive")}
                      disabled={acting !== null}
                      className={`${rowButtonClass} text-neutral-500 dark:text-neutral-400`}
                    >
                      {acting === `${release.id}:archive` ? "归档中…" : "归档"}
                    </button>
                  ) : null}

                  {!release.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(release.id, release.versionName)}
                      disabled={acting !== null}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                    >
                      {acting === `${release.id}:delete` ? "删除中…" : "删除"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
