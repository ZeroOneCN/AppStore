"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 开发者注册表单：开放注册时无需邀请码，邀请码注册时必须填写。
 * @param props.inviteRequired 是否需要邀请码
 * @returns 注册表单
 */
export function RegisterForm({ inviteRequired }: { inviteRequired: boolean }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 提交注册请求，成功后自动登录并进入开发者控制台。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim() || undefined,
          password,
          inviteCode: inviteCode.trim() || undefined,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "注册失败")
            : "注册失败";
        setError(message);
        return;
      }

      router.replace("/developer/apps");
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
          minLength={3}
          maxLength={32}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="3-32 位字母、数字、下划线或连字符"
          className="input-apple"
        />
      </div>

      <div>
        <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium">
          昵称 <span className="font-normal text-neutral-400">（可选）</span>
        </label>
        <input
          id="displayName"
          name="displayName"
          maxLength={40}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="展示在应用详情页的开发者名称"
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
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={64}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 8 位"
          className="input-apple"
        />
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
          确认密码
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={64}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="再次输入密码"
          className="input-apple"
        />
      </div>

      {inviteRequired ? (
        <div>
          <label htmlFor="inviteCode" className="mb-1.5 block text-sm font-medium">
            邀请码
          </label>
          <input
            id="inviteCode"
            name="inviteCode"
            required
            maxLength={40}
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            placeholder="APP-XXXX-XXXX"
            className="input-apple font-mono tracking-wide"
          />
          <p className="mt-1.5 text-[11px] text-neutral-400">邀请码由管理员在后台生成，单次使用</p>
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "注册中…" : "创建开发者账号"}
      </button>

      <p className="text-center text-xs text-neutral-500">
        已有账号？
        <Link href="/login" className="ml-1 font-medium text-brand transition hover:text-brand-deep">
          去登录
        </Link>
      </p>
    </form>
  );
}
