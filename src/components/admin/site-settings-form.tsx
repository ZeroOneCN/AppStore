"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 站点配置 */
export type SiteSettingsValues = {
  siteName: string;
  maxApkMb: number;
  baseUrl: string;
};

/**
 * 站点设置表单：修改站点名称、上传上限与兜底地址。
 * @param props.settings 当前配置
 * @returns 设置表单
 */
export function SiteSettingsForm({ settings }: { settings: SiteSettingsValues }) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(settings.siteName);
  const [maxApkMb, setMaxApkMb] = useState(String(settings.maxApkMb));
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  /**
   * 保存站点配置。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: siteName.trim(),
          maxApkMb: Number(maxApkMb),
          baseUrl: baseUrl.trim(),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const text =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "保存失败")
            : "保存失败";
        setMessage({ type: "error", text });
        return;
      }
      setMessage({ type: "ok", text: "已保存，站点名称将在刷新后生效" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络异常，请稍后重试" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface w-full space-y-4 p-6">
      <div>
        <h2 className="text-sm font-semibold">站点设置</h2>
        <p className="mt-1 text-[11px] text-neutral-500">这些配置保存在数据库中，修改后立即生效，无需重启服务</p>
      </div>

      <div>
        <label htmlFor="siteName" className="mb-1.5 block text-sm font-medium">
          站点名称
        </label>
        <input
          id="siteName"
          value={siteName}
          onChange={(event) => setSiteName(event.target.value)}
          maxLength={40}
          required
          className="input-apple"
        />
      </div>

      <div>
        <label htmlFor="maxApkMb" className="mb-1.5 block text-sm font-medium">
          单个 APK 上传上限（MB）
        </label>
        <input
          id="maxApkMb"
          type="number"
          min={1}
          max={4096}
          value={maxApkMb}
          onChange={(event) => setMaxApkMb(event.target.value)}
          required
          className="input-apple"
        />
      </div>

      <div>
        <label htmlFor="baseUrl" className="mb-1.5 block text-sm font-medium">
          站点兜底地址
        </label>
        <input
          id="baseUrl"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="https://apps.example.com（可留空，优先自动识别）"
          className="input-apple"
        />
        <p className="mt-1.5 text-[11px] leading-5 text-neutral-400">
          页面地址优先根据访问域名自动识别；仅在无请求上下文（如脚本、定时任务）时使用该地址。
        </p>
      </div>

      {message ? (
        <p
          role="status"
          className={`rounded-lg px-3 py-2 text-sm ${
            message.type === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? "保存中…" : "保存站点设置"}
      </button>
    </form>
  );
}
