"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { DeveloperListItem } from "@/server/services/developer.service";
import { errorMessageOf, inputClass, labelClass, primaryButtonClass } from "./ui";

/** 新建开发者表单状态 */
interface CreateState {
  username: string;
  displayName: string;
  password: string;
}

/**
 * 开发者账号管理：新建、启用停用与重置密码。
 * @param props.developers 开发者列表
 * @returns 管理界面
 */
export function DevelopersManager({ developers }: { developers: DeveloperListItem[] }) {
  const router = useRouter();
  const [form, setForm] = useState<CreateState>({ username: "", displayName: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oneTimePassword, setOneTimePassword] = useState<{ username: string; password: string } | null>(
    null,
  );

  /**
   * 创建开发者账号。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    setOneTimePassword(null);
    try {
      const response = await fetch("/api/admin/developers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "创建失败，请检查填写内容"));
        return;
      }
      setNotice(`已创建开发者 ${form.username}，请把初始密码告知对方`);
      setForm({ username: "", displayName: "", password: "" });
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setCreating(false);
    }
  }

  /**
   * 切换开发者启用状态。
   * @param developer 目标开发者
   * @returns 无
   */
  async function toggleStatus(developer: DeveloperListItem): Promise<void> {
    const next = developer.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
    if (next === "DISABLED" && !window.confirm(`停用后 ${developer.username} 将无法登录开发者门户，确定停用？`)) {
      return;
    }

    setActing(`${developer.id}:status`);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/developers/${developer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "状态更新失败"));
        return;
      }
      setNotice(next === "ACTIVE" ? `已启用 ${developer.username}` : `已停用 ${developer.username}`);
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setActing(null);
    }
  }

  /**
   * 重置开发者密码，明文仅展示一次。
   * @param developer 目标开发者
   * @returns 无
   */
  async function resetPassword(developer: DeveloperListItem): Promise<void> {
    if (!window.confirm(`确定重置 ${developer.username} 的密码？旧密码将立即失效。`)) return;

    setActing(`${developer.id}:reset`);
    setError(null);
    setNotice(null);
    setOneTimePassword(null);
    try {
      const response = await fetch(`/api/admin/developers/${developer.id}/reset-password`, {
        method: "POST",
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(errorMessageOf(data, "重置密码失败"));
        return;
      }
      const password =
        data && typeof data === "object" && "password" in data ? String(data.password) : "";
      if (!password) {
        setError("重置成功但未返回新密码，请重试");
        return;
      }
      setOneTimePassword({ username: developer.username, password });
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card-apple p-5">
        <h2 className="text-sm font-semibold">新建开发者</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          开发者账号不开放注册，由管理员在此创建；初始密码至少 8 位，创建后请转交对方并提醒修改。
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="dev-username" className={labelClass}>
              用户名
            </label>
            <input
              id="dev-username"
              required
              minLength={3}
              maxLength={32}
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              className={inputClass}
              placeholder="例如：alice"
            />
          </div>
          <div>
            <label htmlFor="dev-display" className={labelClass}>
              显示名（可选）
            </label>
            <input
              id="dev-display"
              maxLength={40}
              value={form.displayName}
              onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
              className={inputClass}
              placeholder="例如：爱健身团队"
            />
          </div>
          <div>
            <label htmlFor="dev-password" className={labelClass}>
              初始密码
            </label>
            <input
              id="dev-password"
              required
              minLength={8}
              maxLength={64}
              type="text"
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className={inputClass}
              placeholder="至少 8 位"
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" disabled={creating} className={primaryButtonClass}>
              {creating ? "创建中…" : "创建开发者"}
            </button>
          </div>
        </form>

        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </p>
        ) : null}
        {oneTimePassword ? (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            {oneTimePassword.username} 的新密码：{" "}
            <code className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-xs dark:bg-black/20">
              {oneTimePassword.password}
            </code>
            <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
              仅显示一次，请立即转交
            </span>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-500 dark:text-neutral-400">
          全部开发者 · {developers.length}
        </h2>
        {developers.length === 0 ? (
          <div className="card-apple grid min-h-[220px] place-items-center px-6 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              还没有开发者，先在上方创建账号
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {developers.map((developer) => (
              <li
                key={developer.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{developer.username}</span>
                    {developer.displayName ? (
                      <span className="text-xs text-neutral-400">{developer.displayName}</span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        developer.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                      }`}
                    >
                      {developer.status === "ACTIVE" ? "启用" : "停用"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {developer.appCount} 个应用 · 创建于 {formatDateTime(developer.createdAt)}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggleStatus(developer)}
                    disabled={acting !== null}
                    className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    {acting === `${developer.id}:status`
                      ? "更新中…"
                      : developer.status === "ACTIVE"
                        ? "停用"
                        : "启用"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetPassword(developer)}
                    disabled={acting !== null}
                    className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
                  >
                    {acting === `${developer.id}:reset` ? "重置中…" : "重置密码"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
