import { headers } from "next/headers";
import { getEnv } from "../infra/env";

/**
 * 归一化来源地址，去掉末尾斜杠。
 * @param origin 协议 + 主机
 * @returns 归一化后的地址
 */
function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/**
 * 从请求头推导当前部署的站点根地址。
 * 优先使用反向代理透传的 X-Forwarded-Host / X-Forwarded-Proto，兼容直接访问。
 * @param request HTTP 请求
 * @returns 形如 https://example.com 的根地址
 */
export function originFromRequest(request: Request): string {
  const url = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  return normalizeOrigin(`${proto}://${host}`);
}

/**
 * 在服务端组件中读取请求头，推导站点根地址。
 * 没有请求上下文时（构建期、脚本、单测）回退到 BASE_URL。
 * @returns 形如 https://example.com 的根地址
 */
export async function getRequestOrigin(): Promise<string> {
  try {
    const store = await headers();
    const forwardedHost = store.get("x-forwarded-host");
    const host = forwardedHost?.split(",")[0]?.trim() || store.get("host");
    if (host) {
      const forwardedProto = store.get("x-forwarded-proto");
      const fallbackProto = getEnv().BASE_URL.startsWith("https://") ? "https" : "http";
      const proto = forwardedProto?.split(",")[0]?.trim() || fallbackProto;
      return normalizeOrigin(`${proto}://${host}`);
    }
  } catch {
    // 无请求上下文，走环境变量兜底
  }
  return normalizeOrigin(getEnv().BASE_URL);
}
