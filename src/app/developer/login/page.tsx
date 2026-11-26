import { redirect } from "next/navigation";

/**
 * 旧开发者登录入口，统一重定向到 /login。
 * @returns 不返回内容
 */
export default function DeveloperLoginRedirect() {
  redirect("/login");
}
