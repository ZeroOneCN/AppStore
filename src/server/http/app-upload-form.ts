import { AppError } from "../infra/errors";

/** 创建应用并上传安装包时读取的表单内容 */
export interface AppWithApkForm {
  values: Record<string, string>;
  apk: File;
}

/** 允许从表单中读取的文本字段 */
const TEXT_FIELDS = [
  "slug",
  "name",
  "summary",
  "description",
  "category",
  "tags",
  "visibility",
  "pinned",
  "developerId",
  "changelog",
] as const;

/**
 * 解析「创建应用并上传 APK」的 multipart 表单。
 * @param request HTTP 请求
 * @returns 文本字段与 APK 文件
 * @throws AppError 缺少文件或表单格式错误时抛出 VALIDATION_FAILED
 */
export async function readAppWithApkForm(request: Request): Promise<AppWithApkForm> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new AppError("VALIDATION_FAILED", "请使用表单方式提交应用信息与安装包");
  }

  const apk = form.get("apk");
  if (!(apk instanceof File) || apk.size === 0) {
    throw new AppError("VALIDATION_FAILED", "请选择要上传的 APK 安装包");
  }

  const values: Record<string, string> = {};
  for (const key of TEXT_FIELDS) {
    const value = form.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return { values, apk };
}

/**
 * 解析表单中的标签 JSON，非法内容按空数组处理。
 * @param value JSON 字符串
 * @returns 标签数组
 */
export function parseFormTags(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}
