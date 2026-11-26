"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RegistrationMode } from "@/server/infra/constants";

/** 注册模式选项 */
const OPTIONS: Array<{ value: RegistrationMode; label: string; description: string }> = [
  {
    value: "OFF",
    label: "关闭注册",
    description: "仅管理员可在后台创建开发者账号",
  },
  {
    value: "OPEN",
    label: "开放注册",
    description: "任何人都可以自助注册开发者账号",
  },
  {
    value: "INVITE",
    label: "邀请码注册",
    description: "必须填写后台生成的有效邀请码",
  },
];

/**
 * 开发者注册模式设置。
 * @param props.mode 当前注册模式
 * @returns 注册模式表单
 */
export function RegistrationModeForm({ mode }: { mode: RegistrationMode }) {
  const router = useRouter();
  const [value, setValue] = useState<RegistrationMode>(mode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  /**
   * 保存注册模式，后台数据库设置立即生效。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/registration", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: value }),
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
      setMessage({ type: "ok", text: "已保存，注册页立即生效" });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络异常，请稍后重试" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="surface w-full p-6">
      <h2 className="text-sm font-semibold">注册模式</h2>
      <p className="mt-1 text-[11px] text-neutral-500">
        该配置保存在数据库中，后台设置优先，修改后立即生效，无需重启服务
      </p>

      <div className="mt-4 grid gap-2.5">
        {OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition ${
                active
                  ? "border-brand/40 bg-brand/[0.06]"
                  : "border-black/[0.07] bg-white/60 hover:border-brand/25"
              }`}
            >
              <input
                type="radio"
                name="registrationMode"
                value={option.value}
                checked={active}
                onChange={() => setValue(option.value)}
                className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">{option.label}</span>
                <span className="mt-0.5 block text-[11px] leading-5 text-neutral-500">
                  {option.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {message ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <button type="submit" disabled={saving} className="btn-primary mt-4 w-full">
        {saving ? "保存中…" : "保存注册模式"}
      </button>
    </form>
  );
}
