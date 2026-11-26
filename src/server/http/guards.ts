import { redirect } from "next/navigation";
import { requireAdmin, requireDeveloper } from "./session";

/**
 * 页面级管理员校验：未登录时重定向到登录页。
 * 说明：仅依赖布局校验不足以阻止并行渲染的数据泄露，页面数据层需再次校验。
 * @returns 管理员会话载荷
 */
export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
}

/**
 * 页面级开发者校验：未登录或账号停用时重定向到开发者登录页。
 * @returns 开发者会话载荷
 */
export async function requireDeveloperPage() {
  try {
    return await requireDeveloper();
  } catch {
    redirect("/developer/login");
  }
}
