"use client";

import Link from "next/link";
import { useState } from "react";
import { checkApkFile } from "@/lib/apk-file";
import { formatBytes } from "@/lib/format";
import { HelpTip } from "./help-tip";
import type { AdminReleaseData } from "./types";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "./ui";

/** 步骤一返回的解析结果 */
interface StagedParsed {
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  fileSize: number;
  sha256: string;
}

/** 图标候选 */
interface StagedIcon {
  id: string;
  label: string;
  dataUrl: string;
}

/** 暂存上传响应 */
interface StageResponse {
  token: string;
  parsed: StagedParsed;
  icons: StagedIcon[];
}

/** 向导步骤 */
type WizardStep = 1 | 2 | 3;

/** 步骤标题 */
const STEP_LABELS: Array<{ step: WizardStep; title: string; hint: string }> = [
  { step: 1, title: "上传安装包", hint: "选择 APK 并解析版本信息" },
  { step: 2, title: "填写内容", hint: "更新日志与应用图标" },
  { step: 3, title: "发布上线", hint: "确认信息并发布" },
];

/**
 * 三步发布向导：上传解析 → 填写内容与图标 → 确认发布。
 * 第一步把 APK 暂存在服务端，第三步直接提交，无需重复上传大文件。
 * @param props.appId 应用 ID
 * @param props.apiBase 接口前缀
 * @param props.releases 现有版本，用于提示同版本号覆盖
 * @param props.appIconUrl 当前应用图标，用于“保留原图标”选项
 * @param props.appUrl 应用前台页面地址，发布成功后可跳转查看
 * @param props.onDone 发布完成后的回调，参数为提示文案
 * @returns 向导界面
 */
export function PublishWizard({
  appId,
  apiBase = "/api/admin",
  releases,
  appIconUrl,
  appUrl,
  onDone,
}: {
  appId: string;
  apiBase?: string;
  releases: AdminReleaseData[];
  appIconUrl?: string | null;
  appUrl?: string | null;
  onDone: (message: string) => void;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [staged, setStaged] = useState<StageResponse | null>(null);
  const [iconId, setIconId] = useState<string>("");
  const [changelog, setChangelog] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState<"publish" | "draft" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 发布成功后的结果，用于展示完成提示与跳转入口 */
  const [success, setSuccess] = useState<{
    versionName: string;
    versionCode: number;
    publish: boolean;
  } | null>(null);

  const conflict =
    staged !== null && releases.some((release) => release.versionCode === staged.parsed.versionCode);

  /**
   * 重置向导到第一步。
   * @returns 无
   */
  function reset(): void {
    setStep(1);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setProgress(0);
    setStaged(null);
    setIconId("");
    setChangelog("");
    setOverwrite(false);
    setError(null);
    setSubmitting(null);
    setSuccess(null);
  }

  /**
   * 第一步：以二进制流上传并解析，成功后进入第二步。
   * @returns 无
   */
  async function handleStage(): Promise<void> {
    if (!file) {
      setError("请先选择 APK 文件");
      return;
    }
    const invalid = await checkApkFile(file);
    if (invalid) {
      setError(invalid);
      setFile(null);
      setFileInputKey((key) => key + 1);
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    const xhr = new XMLHttpRequest();
    const query = new URLSearchParams({ filename: file.name });
    xhr.open("POST", `${apiBase}/apk/stage?${query.toString()}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      setUploading(false);
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText) as unknown;
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && data) {
        const payload = data as StageResponse;
        setStaged(payload);
        setIconId(payload.icons[0]?.id ?? "");
        const duplicated = releases.some(
          (release) => release.versionCode === payload.parsed.versionCode,
        );
        setOverwrite(duplicated);
        setProgress(100);
        setStep(2);
      } else {
        setError(errorMessageOf(data, `解析失败（HTTP ${xhr.status}），请检查安装包后重试`));
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("上传失败：网络中断或连接被重置");
    };

    xhr.send(file);
  }

  /**
   * 第三步：提交暂存安装包，按选择发布或保存草稿。
   * @param publish 是否立即发布为当前版本
   * @returns 无
   */
  async function handleCommit(publish: boolean): Promise<void> {
    if (!staged) return;
    setSubmitting(publish ? "publish" : "draft");
    setError(null);

    try {
      const response = await fetch(`${apiBase}/apps/${appId}/releases/staged`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: staged.token,
          changelog,
          iconId,
          overwrite,
          publish,
        }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, publish ? "发布失败，请稍后重试" : "保存草稿失败，请稍后重试"));
        return;
      }

      const versionName = staged.parsed.versionName;
      const versionCode = staged.parsed.versionCode;
      const label = `v${versionName}（${versionCode}）`;
      onDone(
        publish
          ? `已发布 ${label} 为当前版本`
          : `已保存 ${label} 为草稿，可在「待发布草稿」中发布`,
      );
      // 保留完成页而不是直接重置，避免用户误以为没有提交
      setSuccess({ versionName, versionCode, publish });
      setChangelog("");
      setStaged(null);
      setIconId("");
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setSubmitting(null);
    }
  }

  // 提交成功后展示完成页：明确告知结果，并提供查看前台页面与继续发布的入口
  if (success) {
    return (
      <section
        role="status"
        className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white">
            ✓
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
              {success.publish ? "发布成功" : "草稿已保存"}
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
              {success.publish
                ? `v${success.versionName}（${success.versionCode}）已设为当前版本，前台下载与更新检查已同步。`
                : `v${success.versionName}（${success.versionCode}）已保存为草稿，可在「待发布草稿」中点击“立即发布”。`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {appUrl ? (
            <Link href={appUrl} target="_blank" rel="noreferrer" className={`${primaryButtonClass} px-4 py-2`}>
              {success.publish ? "查看已发布的应用页面" : "查看应用页面"}
            </Link>
          ) : null}
          <button type="button" onClick={reset} className={secondaryButtonClass}>
            继续发布新版本
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">发布新版本</h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          上传 → 填写 → 发布，三步完成
        </p>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {STEP_LABELS.map((item) => {
          const active = step === item.step;
          const done = step > item.step;
          return (
            <li
              key={item.step}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                active
                  ? "border-indigo-300 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                  : "border-neutral-200 dark:border-neutral-800"
              }`}
            >
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done
                    ? "bg-indigo-600 text-white"
                    : active
                      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {done ? "✓" : item.step}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="block truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                  {item.hint}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="wizard-apk" className={labelClass}>
              APK 文件
              <HelpTip text="先上传并解析，确认版本信息后再填写内容，避免重复上传几十 MB 文件。" />
            </label>
            <input
              key={fileInputKey}
              id="wizard-apk"
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white dark:border-neutral-700 dark:bg-neutral-950 dark:file:bg-indigo-500"
            />
          </div>

          {uploading ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all"
                  style={{ width: `${Math.max(progress, 4)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                {progress >= 100 ? "上传完成，正在解析版本信息…" : `正在上传… ${progress}%`}
              </p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleStage()}
            disabled={uploading}
            className={`${primaryButtonClass} px-6 py-2.5`}
          >
            {uploading ? "上传并解析中…" : "上传并解析"}
          </button>
        </div>
      ) : null}

      {step === 2 && staged ? (
        <div className="mt-4 space-y-4">
          <dl className="grid gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm sm:grid-cols-2 dark:bg-neutral-900">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">版本</dt>
              <dd className="font-medium">v{staged.parsed.versionName}（{staged.parsed.versionCode}）</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">包名</dt>
              <dd className="truncate font-mono text-xs">{staged.parsed.packageName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">大小</dt>
              <dd>{formatBytes(staged.parsed.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">最低 API</dt>
              <dd>{staged.parsed.minSdk ?? "未声明"}</dd>
            </div>
          </dl>

          {conflict ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-500/10">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={(event) => setOverwrite(event.target.checked)}
                className="mt-0.5 size-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="min-w-0 text-sm">
                <span className="block font-medium text-amber-900 dark:text-amber-200">
                  版本号 {staged.parsed.versionCode} 已存在
                </span>
                <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300">
                  勾选后覆盖同版本号：替换安装包与包信息，保留发布时间与下载统计。
                </span>
              </span>
            </label>
          ) : null}

          <div>
            <label htmlFor="wizard-changelog" className={labelClass}>
              更新日志
              <HelpTip text="展示在详情页与客户端更新弹窗，支持换行。" />
            </label>
            <textarea
              id="wizard-changelog"
              rows={3}
              maxLength={2000}
              value={changelog}
              onChange={(event) => setChangelog(event.target.value)}
              className={inputClass}
              placeholder="例如：修复导入崩溃，优化列表加载"
            />
          </div>

          <div>
            <p className={labelClass}>
              应用图标
              <HelpTip text="列出 APK 内全部图标，默认选中最高清的一张；发布后同步更新应用图标。" />
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {appIconUrl ? (
                <label
                  className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
                    iconId === ""
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="wizard-icon"
                    checked={iconId === ""}
                    onChange={() => setIconId("")}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={appIconUrl} alt="当前图标" className="size-12 rounded-xl object-cover" />
                  <span className="line-clamp-2 text-[11px] text-neutral-600 dark:text-neutral-400">保留当前图标</span>
                </label>
              ) : null}
              {staged.icons.map((icon) => (
                <label
                  key={icon.id}
                  className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-2 text-center transition ${
                    iconId === icon.id
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                      : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                  }`}
                >
                  <input
                    type="radio"
                    name="wizard-icon"
                    checked={iconId === icon.id}
                    onChange={() => setIconId(icon.id)}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={icon.dataUrl} alt={icon.label} className="size-12 rounded-xl object-cover" />
                  <span className="line-clamp-2 text-[11px] text-neutral-600 dark:text-neutral-400">{icon.label}</span>
                </label>
              ))}
            </div>
            {staged.icons.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                未在该 APK 中解析到图标，可发布后在「图标与截图」中手动上传。
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep(3)} className={`${primaryButtonClass} px-6 py-2.5`}>
              下一步
            </button>
            <button type="button" onClick={reset} className={secondaryButtonClass}>
              重新上传
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 && staged ? (
        <div className="mt-4 space-y-4">
          <dl className="space-y-2 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">版本</dt>
              <dd className="font-medium">v{staged.parsed.versionName}（{staged.parsed.versionCode}）</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">文件</dt>
              <dd>{formatBytes(staged.parsed.fileSize)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">更新日志</dt>
              <dd className="min-w-0 truncate text-right">{changelog.trim() || "未填写"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">图标</dt>
              <dd>
                {iconId === ""
                  ? "保留当前图标"
                  : staged.icons.find((icon) => icon.id === iconId)?.label ?? "默认最高清"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">同版本号</dt>
              <dd>{conflict ? (overwrite ? "覆盖" : "未勾选覆盖（将被拒绝）") : "无冲突"}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCommit(true)}
              disabled={submitting !== null || (conflict && !overwrite)}
              className={`${primaryButtonClass} px-6 py-2.5`}
            >
              {submitting === "publish" ? "发布中…" : "发布上线"}
            </button>
            <button
              type="button"
              onClick={() => void handleCommit(false)}
              disabled={submitting !== null || (conflict && !overwrite)}
              className={secondaryButtonClass}
            >
              {submitting === "draft" ? "保存中…" : "保存为草稿"}
            </button>
            <button type="button" onClick={() => setStep(2)} className={secondaryButtonClass}>
              上一步
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
