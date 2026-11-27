import { clientIpFromRequest, recordInstall, type InstallType } from "@/server/services/analytics.service";
import { enforceRateLimit } from "@/server/http/rate-limit";

/**
 * 安装上报：客户端在安装或更新完成后调用，用于统计首次安装、更新与设备信息。
 * 请求体：{ packageName, versionCode, installType, deviceModel?, osVersion?, channel? }
 * @param request HTTP 请求
 * @returns 成功或应用不存在的 JSON 结果
 */
export async function POST(request: Request): Promise<Response> {
  const limit = enforceRateLimit(`install:${clientIpFromRequest(request)}`, 30, 60_000);
  if (!limit.allowed) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: "上报过于频繁，请稍后再试" } },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: { code: "VALIDATION_FAILED", message: "请求体必须是 JSON" } }, { status: 400 });
  }

  const data = body as {
    packageName?: unknown;
    versionCode?: unknown;
    installType?: unknown;
    deviceModel?: unknown;
    osVersion?: unknown;
    channel?: unknown;
  };

  const packageName = typeof data.packageName === "string" ? data.packageName.trim() : "";
  const versionCode = typeof data.versionCode === "number" ? data.versionCode : Number(data.versionCode);
  const installType = data.installType as InstallType;

  if (!packageName || !Number.isInteger(versionCode) || versionCode <= 0) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "packageName 与 versionCode 必填" } },
      { status: 400 },
    );
  }
  if (installType !== "install" && installType !== "update") {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "installType 只能是 install 或 update" } },
      { status: 400 },
    );
  }

  const matched = await recordInstall({
    request,
    packageName,
    versionCode,
    installType,
    deviceModel: typeof data.deviceModel === "string" ? data.deviceModel : "",
    osVersion: typeof data.osVersion === "string" ? data.osVersion : "",
    channel: typeof data.channel === "string" ? data.channel : "",
  });

  if (!matched) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "未找到对应应用，请确认包名是否正确" } },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
