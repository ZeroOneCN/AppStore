import { redirect } from "next/navigation";

/**
 * 旧管理员登录入口，统一重定向到 /login。
 * @returns 不返回内容
 */
export default function AdminLoginRedirect() {
  redirect("/login");
}
