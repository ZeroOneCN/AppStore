"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * 退出登录按钮，清除会话后回到登录页。
 * @param props.endpoint 登出接口地址
 * @param props.redirectTo 登出后跳转路径
 * @returns 退出按钮
 */
export function LogoutButton({
  endpoint = "/api/admin/logout",
  redirectTo = "/admin/login",
}: {
  endpoint?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  /**
   * 调用登出接口并跳转登录页。
   * @returns 无
   */
  async function handleLogout(): Promise<void> {
    setLoading(true);
    try {
      await fetch(endpoint, { method: "POST" });
    } catch {
      // 即使请求失败也跳转登录页，Cookie 未清除时页面会重新校验
    } finally {
      router.replace(redirectTo);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs transition hover:bg-neutral-100 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      {loading ? "退出中…" : "退出登录"}
    </button>
  );
}
