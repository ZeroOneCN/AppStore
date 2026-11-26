import { redirect } from "next/navigation";

/**
 * 旧开发者文档入口，统一重定向到公开接入文档。
 * @returns 不返回内容
 */
export default function DeveloperDocsRedirect() {
  redirect("/docs");
}
