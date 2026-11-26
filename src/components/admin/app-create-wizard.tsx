"use client";

import Link from "next/link";
import { useState } from "react";
import { checkApkFile } from "@/lib/apk-file";
import { formatBytes } from "@/lib/format";
import { generateSlug } from "@/lib/slug";
import { HelpTip } from "./help-tip";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "./ui";

/** 暂存解析结果 */
interface StagedParsed {
  packageName: string;
  versionCode: number;
  versionName: string;
  minSdk: number | null;
  fileSize: number;
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
const STEP_LABELS: Array<{ step: WizardStep; title: string }> = [
  { step: 1, title: "上传解析" },
  { step: 2, title: "填写内容" },
  { step: 3, title: "确认发布" },
];

/**
 * 新建应用三步向导：上传 APK 解析 → 填写应用内容与选择图标 → 创建并发布。
 * 网页作品跳过上传步骤，直接填写链接与内容。
 * @param props.apiBase 应用接口前缀，如 /api/admin/apps
 * @param props.afterCreateBase 创建成功后跳转的详情页前缀
 * @param props.categories 已有分类候选
 * @param props.tagOptions 已有标签候选
 * @param props.developerOptions 可指派开发者
 * @param props.showAdminFields 是否展示置顶与归属开发者字段
 * @returns 向导界面
 */
export function AppCreateWizard({
  apiBase = "/api/admin/apps",
  afterCreateBase = "/admin/apps",
  categories = [],
  tagOptions = [],
  developerOptions = [],
  showAdminFields = true,
}: {
  apiBase?: string;
  afterCreateBase?: string;
  categories?: string[];
  tagOptions?: string[];
  developerOptions?: { id: string; username: string; displayName: string }[];
  showAdminFields?: boolean;
}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [type, setType] = useState<"ANDROID" | "WEB">("ANDROID");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [staged, setStaged] = useState<StageResponse | null>(null);
  const [iconId, setIconId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [webUrl, setWebUrl] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [pinned, setPinned] = useState(false);
  const [developerId, setDeveloperId] = useState("");
  const [changelog, setChangelog] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 创建成功后的结果，用于展示完成提示与跳转入口 */
  const [success, setSuccess] = useState<{
    id: string;
    slug: string;
    versionName?: string;
    versionCode?: number;
    published: boolean;
  } | null>(null);

  const tagList = tags
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);

  const stageBase = `${apiBase.replace(/\/apps$/, "")}/apk/stage`;

  /**
   * 更新应用名称；访问标识未手动修改时同步生成。
   * @param value 应用名称
   * @returns 无
   */
  function updateName(value: string): void {
    setName(value);
    if (!slugTouched) setSlug(generateSlug(value));
  }

  /**
   * 切换应用类型，切换时清空安装包暂存。
   * @param next 目标类型
   * @returns 无
   */
  function updateType(next: "ANDROID" | "WEB"): void {
    if (next === type) return;
    setType(next);
    setStaged(null);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setIconId("");
    setProgress(0);
    setStep(1);
    setError(null);
  }

  /**
   * 第一步：上传并解析 APK，成功后进入第二步。
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
    xhr.open("POST", `${stageBase}?${query.toString()}`);
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
   * 校验第二步必填项并进入第三步。
   * @returns 无
   */
  function goReview(): void {
    setError(null);
    if (!name.trim()) return setError("请填写应用名称");
    if (!summary.trim()) return setError("请填写一句话简介");
    if (!category.trim()) return setError("请填写分类");
    if (type === "WEB" && !/^https?:\/\//i.test(webUrl.trim())) {
      return setError("请填写以 http:// 或 https:// 开头的访问链接");
    }
    if (type === "ANDROID" && !staged) {
      return setError("安装包尚未解析，请返回第一步重新上传");
    }
    if (!slug.trim()) setSlug(generateSlug(name));
    setStep(3);
  }

  /**
   * 第三步：创建应用并发布首个版本。
   * @returns 无
   */
  async function handleCreate(): Promise<void> {
    setSubmitting(true);
    setError(null);

    const basePayload = {
      slug: slug.trim() || generateSlug(name),
      name: name.trim(),
      summary: summary.trim(),
      description,
      type,
      category: category.trim(),
      tags: tagList,
      visibility,
      ...(showAdminFields ? { pinned, developerId: developerId || null } : {}),
    };

    try {
      const response =
        type === "ANDROID"
          ? await fetch(`${apiBase}/with-apk`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...basePayload,
                token: staged?.token,
                changelog,
                iconId,
              }),
            })
          : await fetch(apiBase, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...basePayload, webUrl: webUrl.trim(), packageName: null }),
            });

      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "创建失败，请检查填写内容"));
        return;
      }

      const created =
        data && typeof data === "object"
          ? (data as {
              id?: unknown;
              slug?: unknown;
              release?: { versionName?: string; versionCode?: number };
            })
          : null;
      const id = created?.id ? String(created.id) : "";
      setSuccess({
        id,
        slug: created?.slug ? String(created.slug) : slug.trim() || generateSlug(name),
        versionName: created?.release?.versionName,
        versionCode: created?.release?.versionCode,
        published: type === "ANDROID",
      });
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // 创建成功后展示完成页：明确告知结果，并提供前台页面、管理页与返回列表入口
  if (success) {
    const versionLabel = success.versionName
      ? `v${success.versionName}${success.versionCode ? `（${success.versionCode}）` : ""}`
      : "";
    const managementParams = new URLSearchParams({ created: "1" });
    if (versionLabel) managementParams.set("version", versionLabel);
    const managementHref = success.id
      ? `${afterCreateBase}/${success.id}?${managementParams.toString()}`
      : afterCreateBase;

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
              {success.published ? "应用已创建并发布" : "应用已创建"}
            </p>
            <p className="mt-1 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
              {success.published
                ? `${name} 的 ${versionLabel} 已发布为当前版本，前台可立即查看与下载。`
                : `${name} 已创建，可进入管理页上传版本或调整内容。`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {visibility === "PUBLIC" ? (
            <Link
              href={`/apps/${success.slug}`}
              target="_blank"
              rel="noreferrer"
              className={`${primaryButtonClass} px-4 py-2`}
            >
              查看已发布的应用页面
            </Link>
          ) : null}
          <Link href={managementHref} className={secondaryButtonClass}>
            进入应用管理
          </Link>
          <Link href={afterCreateBase} className={secondaryButtonClass}>
            返回应用列表
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="grid gap-2 sm:grid-cols-3">
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
              <span className="text-sm font-medium">{item.title}</span>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-semibold">第 1 步 · 上传安装包并解析</h2>

          <div className="mb-4 flex gap-2">
            {[
              { value: "ANDROID" as const, label: "Android 应用" },
              { value: "WEB" as const, label: "网页作品" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateType(option.value)}
                className={`rounded-xl border px-3.5 py-2 text-sm transition ${
                  type === option.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {type === "ANDROID" ? (
            <div className="space-y-3">
              <div>
                <label htmlFor="create-apk" className={labelClass}>
                  APK 文件
                  <HelpTip text="先上传解析包名与版本号，确认无误后再填写应用内容并发布。" />
                </label>
                <input
                  key={fileInputKey}
                  id="create-apk"
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-1.5 file:text-white dark:border-neutral-700 dark:bg-neutral-950 dark:file:bg-indigo-500"
                />
              </div>

              {staged ? (
                <dl className="grid gap-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm sm:grid-cols-2 dark:bg-neutral-950">
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">包名</dt>
                    <dd className="truncate font-mono text-xs">{staged.parsed.packageName}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-neutral-500 dark:text-neutral-400">版本</dt>
                    <dd className="font-medium">
                      v{staged.parsed.versionName}（{staged.parsed.versionCode}）
                    </dd>
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
              ) : null}

              {uploading ? (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.max(progress, 4)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {progress >= 100 ? "上传完成，正在解析…" : `正在上传… ${progress}%`}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleStage()}
                  disabled={uploading}
                  className={primaryButtonClass}
                >
                  {uploading ? "上传并解析中…" : staged ? "重新上传并解析" : "上传并解析"}
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!staged}
                  className={secondaryButtonClass}
                >
                  下一步
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-950 dark:text-neutral-300">
                网页作品无需上传安装包，下一步填写访问链接与展示内容即可。
              </p>
              <button type="button" onClick={() => setStep(2)} className={primaryButtonClass}>
                下一步
              </button>
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-4 text-sm font-semibold">第 2 步 · 填写应用内容</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="create-name" className={labelClass}>
                应用名称
              </label>
              <input
                id="create-name"
                maxLength={60}
                value={name}
                onChange={(event) => updateName(event.target.value)}
                className={inputClass}
                placeholder="例如：应用仓库"
              />
            </div>

            <div>
              <label htmlFor="create-slug" className={labelClass}>
                访问标识
                <HelpTip text="根据名称自动生成，仅支持小写字母、数字与连字符；重名会自动追加序号。" />
              </label>
              <input
                id="create-slug"
                maxLength={48}
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                className={inputClass}
                placeholder="输入名称后自动生成"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="create-summary" className={labelClass}>
                一句话简介
              </label>
              <input
                id="create-summary"
                maxLength={120}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                className={inputClass}
                placeholder="展示在应用卡片上，不超过 120 字"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="create-description" className={labelClass}>
                详细介绍
              </label>
              <textarea
                id="create-description"
                rows={4}
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={inputClass}
                placeholder="支持换行，展示在详情页"
              />
            </div>

            <div>
              <label htmlFor="create-category" className={labelClass}>
                分类
              </label>
              <input
                id="create-category"
                maxLength={30}
                list="create-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={inputClass}
                placeholder="例如：工具"
              />
              <datalist id="create-category-options">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </div>

            <div>
              <label htmlFor="create-tags" className={labelClass}>
                标签
                <HelpTip text="用于前台筛选，逗号分隔，最多 10 个。" />
              </label>
              <input
                id="create-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                className={inputClass}
                placeholder="例如：离线, 本地存储"
              />
              {tagOptions.filter((tag) => !tagList.includes(tag)).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tagOptions
                    .filter((tag) => !tagList.includes(tag))
                    .slice(0, 8)
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setTags([...tagList, tag].join(", "))}
                        className="rounded-full border border-neutral-200 px-2 py-0.5 text-[11px] text-neutral-600 transition hover:border-brand/40 hover:text-brand dark:border-neutral-700 dark:text-neutral-300"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              ) : null}
            </div>

            {type === "WEB" ? (
              <div className="sm:col-span-2">
                <label htmlFor="create-web-url" className={labelClass}>
                  访问链接
                </label>
                <input
                  id="create-web-url"
                  type="url"
                  maxLength={500}
                  value={webUrl}
                  onChange={(event) => setWebUrl(event.target.value)}
                  className={inputClass}
                  placeholder="https://example.com"
                />
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label htmlFor="create-changelog" className={labelClass}>
                  首个版本更新说明
                  <HelpTip text="作为首个版本的更新日志，展示在版本历史与详情页。" />
                </label>
                <textarea
                  id="create-changelog"
                  rows={3}
                  maxLength={2000}
                  value={changelog}
                  onChange={(event) => setChangelog(event.target.value)}
                  className={inputClass}
                  placeholder="例如：首个版本，支持应用浏览与更新检查"
                />
              </div>
            )}

            <div>
              <label htmlFor="create-visibility" className={labelClass}>
                可见性
                <HelpTip text="公开应用会展示在应用广场；私有应用仅自己与管理员可见。" />
              </label>
              <select
                id="create-visibility"
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}
                className={inputClass}
              >
                <option value="PUBLIC">公开（展示在应用广场）</option>
                <option value="PRIVATE">私有（仅自己与管理员可见）</option>
              </select>
            </div>

            {showAdminFields ? (
              <>
                <div>
                  <label htmlFor="create-developer" className={labelClass}>
                    归属开发者
                    <HelpTip text="指派后该开发者可在开发者门户管理此应用；留空表示管理员直接管理。" />
                  </label>
                  <select
                    id="create-developer"
                    value={developerId}
                    onChange={(event) => setDeveloperId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">未指派（管理员管理）</option>
                    {developerOptions.map((developer) => (
                      <option key={developer.id} value={developer.id}>
                        {developer.displayName
                          ? `${developer.displayName}（${developer.username}）`
                          : developer.username}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2.5 self-end rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm dark:border-neutral-700">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(event) => setPinned(event.target.checked)}
                    className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand/30"
                  />
                  置顶展示
                </label>
              </>
            ) : null}
          </div>

          {type === "ANDROID" && staged && staged.icons.length > 0 ? (
            <div className="mt-4">
              <p className={labelClass}>
                应用图标
                <HelpTip text="列出 APK 内全部图标，默认选中最高清的一张，可自行切换。" />
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
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
                      name="create-icon"
                      checked={iconId === icon.id}
                      onChange={() => setIconId(icon.id)}
                      className="sr-only"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={icon.dataUrl} alt={icon.label} className="size-12 rounded-xl object-cover" />
                    <span className="line-clamp-2 text-[11px] text-neutral-600 dark:text-neutral-400">
                      {icon.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={goReview} className={primaryButtonClass}>
              下一步
            </button>
            <button type="button" onClick={() => setStep(1)} className={secondaryButtonClass}>
              上一步
            </button>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-3 text-sm font-semibold">第 3 步 · 确认并发布</h2>
          <dl className="space-y-2 rounded-xl bg-neutral-50 px-4 py-3 text-sm dark:bg-neutral-950">
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">类型</dt>
              <dd>{type === "ANDROID" ? "Android 应用" : "网页作品"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">名称</dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">访问标识</dt>
              <dd className="font-mono text-xs">/{slug || generateSlug(name)}</dd>
            </div>
            {type === "ANDROID" && staged ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500 dark:text-neutral-400">版本</dt>
                  <dd>
                    v{staged.parsed.versionName}（{staged.parsed.versionCode}）
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-neutral-500 dark:text-neutral-400">包名</dt>
                  <dd className="truncate font-mono text-xs">{staged.parsed.packageName}</dd>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-3">
                <dt className="text-neutral-500 dark:text-neutral-400">链接</dt>
                <dd className="truncate">{webUrl}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500 dark:text-neutral-400">可见性</dt>
              <dd>{visibility === "PUBLIC" ? "公开" : "私有"}</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={submitting}
              className={`${primaryButtonClass} px-6 py-2.5`}
            >
              {submitting
                ? "创建中…"
                : type === "ANDROID"
                  ? "创建并发布"
                  : "创建应用"}
            </button>
            <button type="button" onClick={() => setStep(2)} className={secondaryButtonClass}>
              上一步
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
