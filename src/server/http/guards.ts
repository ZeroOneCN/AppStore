import { redirect } from "next/navigation";
import { requireAdmin, requireDeveloper } from "./session";

/**
 * 生成统一登录页地址，附带登录成功后的目标路径。
 * @param next 目标路径
 * @returns 登录页地址
 */
export function loginHref(next: string): string {
  return `/login?next=${encodeURIComponent(next)}`;
}

/**
 * 页面级管理员校验：未登录或角色不符时重定向到统一登录页。
 * 说明：仅依赖布局校验不足以阻止并行渲染的数据泄露，页面数据层需再次校验。
 * @param next 登录成功后的目标路径
 * @returns 管理员会话载荷
 */
export async function requireAdminPage(next = "/admin/apps") {
  try {
    return await requireAdmin();
  } catch {
    redirect(loginHref(next));
  }
}

/**
 * 页面级开发者校验：未登录、角色不符或账号停用时重定向到统一登录页。
 * @param next 登录成功后的目标路径
 * @returns 开发者会话载荷
 */
export async function requireDeveloperPage(next = "/developer/apps") {
  try {
    return await requireDeveloper();
  } catch {
    redirect(loginHref(next));
  }
}
