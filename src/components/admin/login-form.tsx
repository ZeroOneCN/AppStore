"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** 统一登录响应 */
type LoginResponse = {
  role?: "admin" | "developer";
  redirectTo?: string;
};

/**
 * 判断登录目标地址是否属于该角色的控制台区域。
 * @param target 目标路径
 * @param role 角色
 * @returns 允许跳转返回 true
 */
function isAllowedTarget(target: string | null, role: "admin" | "developer"): target is string {
  if (!target || !target.startsWith("/")) return false;
  return role === "admin" ? target.startsWith("/admin") : target.startsWith("/developer");
}

/**
 * 统一登录表单，管理员与开发者共用同一入口，登录后按角色跳转。
 * @param props.next 登录成功后希望返回的站内路径（仅在角色匹配时生效）
 * @param props.endpoint 登录接口地址
 * @param props.submitLabel 提交按钮文案
 * @returns 登录表单
 */
export function LoginForm({
  next = null,
  endpoint = "/api/auth/login",
  submitLabel = "登录",
}: {
  next?: string | null;
  endpoint?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 提交登录请求，成功后按返回的角色进入对应控制台。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "登录失败")
            : "登录失败";
        setError(message);
        return;
      }

      const data = payload as LoginResponse | null;
      const role = data?.role === "developer" ? "developer" : "admin";
      const fallback = role === "admin" ? "/admin/apps" : "/developer/apps";
      const target = isAllowedTarget(next, role) ? next : data?.redirectTo || fallback;

      router.replace(target);
      router.refresh();
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
          用户名
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="input-apple"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="input-apple"
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "登录中…" : submitLabel}
      </button>
    </form>
  );
}
