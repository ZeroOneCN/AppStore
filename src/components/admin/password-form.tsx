"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass } from "./ui";

/**
 * 修改密码表单，成功后退出登录并要求重新登录。
 * @param props.endpoint 修改密码接口地址
 * @param props.logoutEndpoint 登出接口地址
 * @param props.loginPath 登出后跳转的登录页
 * @param props.note 表单底部说明文案
 * @returns 密码表单界面
 */
export function PasswordForm({
  endpoint = "/api/admin/password",
  logoutEndpoint = "/api/admin/logout",
  loginPath = "/admin/login",
  note = "修改成功后当前会话会退出，需使用新密码重新登录；已签发的旧令牌在过期前仍然有效。",
}: {
  endpoint?: string;
  logoutEndpoint?: string;
  loginPath?: string;
  note?: string;
}) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /**
   * 提交修改密码请求。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (newPassword.length < 8) {
      setError("新密码至少 8 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "修改失败，请检查当前密码"));
        return;
      }

      setNotice("密码已更新，正在退出登录…");
      await fetch(logoutEndpoint, { method: "POST" }).catch(() => null);
      router.push(loginPath);
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-apple max-w-xl space-y-4 p-5">
      <div>
        <label htmlFor="currentPassword" className={labelClass}>
          当前密码
        </label>
        <input
          id="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="newPassword" className={labelClass}>
          新密码
        </label>
        <input
          id="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className={inputClass}
          placeholder="至少 8 位"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className={labelClass}>
          确认新密码
        </label>
        <input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={inputClass}
        />
      </div>

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

      <button type="submit" disabled={saving} className={primaryButtonClass}>
        {saving ? "保存中…" : "修改密码"}
      </button>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{note}</p>
    </form>
  );
}
