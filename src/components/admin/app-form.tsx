"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HelpTip } from "./help-tip";
import type { AdminAppData } from "./types";
import { generateSlug } from "@/lib/slug";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass } from "./ui";

/** 表单内部状态 */
interface FormState {
  slug: string;
  name: string;
  summary: string;
  description: string;
  type: "ANDROID" | "WEB";
  category: string;
  tags: string;
  webUrl: string;
  packageName: string;
  visibility: "PUBLIC" | "PRIVATE";
  pinned: boolean;
}

/**
 * 应用新建 / 编辑表单。
 * @param props.mode 表单模式
 * @param props.app 编辑模式下的初始数据
 * @returns 表单界面
 */
export function AppForm({ mode, app }: { mode: "create" | "edit"; app?: AdminAppData }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    slug: app?.slug ?? "",
    name: app?.name ?? "",
    summary: app?.summary ?? "",
    description: app?.description ?? "",
    type: app?.type ?? "ANDROID",
    category: app?.category ?? "",
    tags: (app?.tags ?? []).join(", "),
    webUrl: app?.webUrl ?? "",
    packageName: app?.packageName ?? "",
    visibility: app?.visibility ?? "PUBLIC",
    pinned: app?.pinned ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 新建时访问标识默认跟随名称自动生成，手动修改后不再覆盖
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  /**
   * 更新单个表单字段。
   * @param key 字段名
   * @param value 新值
   * @returns 无
   */
  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /**
   * 更新应用名称；访问标识未被手动修改时同步自动生成。
   * @param value 应用名称
   * @returns 无
   */
  function updateName(value: string): void {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugTouched ? prev.slug : generateSlug(value),
    }));
  }

  /**
   * 按当前名称重新生成访问标识。
   * @returns 无
   */
  function regenerateSlug(): void {
    setSlugTouched(false);
    setForm((prev) => ({ ...prev, slug: generateSlug(prev.name) }));
  }

  /**
   * 提交表单：新建后跳转详情页，编辑后刷新服务端数据。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      slug: form.slug.trim() || generateSlug(form.name),
      name: form.name.trim(),
      summary: form.summary.trim(),
      description: form.description,
      type: form.type,
      category: form.category.trim(),
      tags: form.tags
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
      webUrl: form.type === "WEB" ? form.webUrl.trim() || null : null,
      packageName: form.type === "ANDROID" ? form.packageName.trim() || null : null,
      visibility: form.visibility,
      pinned: form.pinned,
    };

    try {
      const response = await fetch(mode === "create" ? "/api/admin/apps" : `/api/admin/apps/${app?.id}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(errorMessageOf(data, "保存失败，请检查填写内容"));
        return;
      }

      if (mode === "create") {
        const id = data && typeof data === "object" && "id" in data ? String(data.id) : "";
        router.push(id ? `/admin/apps/${id}` : "/admin/apps");
        return;
      }

      setNotice("已保存");
      router.refresh();
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-sm font-semibold">基本信息</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={labelClass}>
              应用名称
            </label>
            <input
              id="name"
              required
              maxLength={60}
              value={form.name}
              onChange={(event) => updateName(event.target.value)}
              className={inputClass}
              placeholder="例如：包裹管家"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="slug" className="flex items-center gap-1.5 text-sm font-medium">
                访问标识
                <HelpTip text="根据应用名称自动生成，可手动修改；仅支持 2-48 位小写字母、数字与连字符，重名时会自动追加序号。" />
              </label>
              <button
                type="button"
                onClick={regenerateSlug}
                className="shrink-0 text-xs font-medium text-brand transition hover:text-brand-deep"
              >
                重新生成
              </button>
            </div>
            <input
              id="slug"
              required
              maxLength={48}
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                update("slug", event.target.value);
              }}
              className={inputClass}
              placeholder="输入名称后自动生成"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="summary" className={labelClass}>
              一句话简介
            </label>
            <input
              id="summary"
              required
              maxLength={120}
              value={form.summary}
              onChange={(event) => update("summary", event.target.value)}
              className={inputClass}
              placeholder="展示在应用卡片上，不超过 120 字"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="description" className={labelClass}>
              详细介绍
            </label>
            <textarea
              id="description"
              rows={5}
              maxLength={5000}
              value={form.description}
              onChange={(event) => update("description", event.target.value)}
              className={inputClass}
              placeholder="支持换行，展示在详情页"
            />
          </div>

          <div>
            <label htmlFor="category" className={labelClass}>
              分类
            </label>
            <input
              id="category"
              required
              maxLength={30}
              value={form.category}
              onChange={(event) => update("category", event.target.value)}
              className={inputClass}
              placeholder="例如：工具"
            />
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>
              标签
              <HelpTip text="用于前台标签筛选，可用中文或英文逗号分隔，最多 10 个。" />
            </label>
            <input
              id="tags"
              value={form.tags}
              onChange={(event) => update("tags", event.target.value)}
              className={inputClass}
              placeholder="例如：离线, 本地存储"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold">
          类型与链接
          <HelpTip text="Android 应用需要上传 APK 后才能下载；网页作品只保存访问链接与截图。" />
        </h2>

        <div className="mb-4 flex gap-2">
          {[
            { value: "ANDROID" as const, label: "Android 应用" },
            { value: "WEB" as const, label: "网页作品" },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => update("type", option.value)}
              className={`rounded-xl border px-3.5 py-2 text-sm transition ${
                form.type === option.value
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300"
                  : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {form.type === "ANDROID" ? (
          <div>
            <label htmlFor="packageName" className={labelClass}>
              Android 包名
              <HelpTip text="必须与 APK 内的包名完全一致，用于上传校验与更新检测。上传 APK 后会自动解析并核对。" />
            </label>
            <input
              id="packageName"
              required
              maxLength={128}
              value={form.packageName}
              onChange={(event) => update("packageName", event.target.value)}
              className={inputClass}
              placeholder="例如：com.example.myapp"
            />
          </div>
        ) : (
          <div>
            <label htmlFor="webUrl" className={labelClass}>
              访问链接
              <HelpTip text="网页作品的跳转地址，必须是完整的 http:// 或 https:// 链接。" />
            </label>
            <input
              id="webUrl"
              required
              type="url"
              maxLength={500}
              value={form.webUrl}
              onChange={(event) => update("webUrl", event.target.value)}
              className={inputClass}
              placeholder="https://example.com"
            />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-4 text-sm font-semibold">展示设置</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="visibility" className={labelClass}>
              可见性
              <HelpTip text="私有应用不会出现在公开应用墙，图标与截图也需要管理员登录才能访问。" />
            </label>
            <select
              id="visibility"
              value={form.visibility}
              onChange={(event) => update("visibility", event.target.value as FormState["visibility"])}
              className={inputClass}
            >
              <option value="PUBLIC">公开</option>
              <option value="PRIVATE">私有（仅管理员可见）</option>
            </select>
          </div>

          <label className="flex items-center gap-2.5 self-end rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm dark:border-neutral-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(event) => update("pinned", event.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
            />
            置顶展示
            <HelpTip text="置顶应用会在应用墙与后台列表顶部优先展示。" />
          </label>
        </div>
      </section>

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

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={primaryButtonClass}>
          {saving ? "保存中…" : mode === "create" ? "创建应用" : "保存修改"}
        </button>
        {mode === "create" ? (
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            创建后可上传 APK、图标与截图
          </span>
        ) : null}
      </div>
    </form>
  );
}
