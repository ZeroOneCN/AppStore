import { pinyin } from "pinyin-pro";

/** 访问标识允许的最大长度 */
const MAX_LENGTH = 48;

/**
 * 根据应用名称生成可读的访问标识。
 * 中文会转写为拼音，英文与数字保留，其余字符转为连字符。
 * @param name 应用名称
 * @returns 2-48 位小写字母、数字与连字符组成的标识
 */
export function generateSlug(name: string): string {
  const source = name.trim();
  if (!source) return "";

  // 中文按拼音逐字转写，非中文内容原样保留
  const romanized = /[\u4e00-\u9fa5]/.test(source)
    ? pinyin(source, { toneType: "none", type: "array", nonZh: "consecutive" }).join("-")
    : source;

  const base = romanized
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_LENGTH)
    .replace(/-+$/g, "");

  if (base.length >= 2) return base;

  // 名称全为符号等极端场景，退化为随机标识
  return `app-${Date.now().toString(36).slice(-6)}`;
}
