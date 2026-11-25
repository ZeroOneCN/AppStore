/** 统一的展示格式化工具，固定时区与区域，避免服务端与客户端渲染结果不一致。 */

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * 将字节数格式化为易读文本。
 * @param bytes 字节数，非法值按 0 处理
 * @returns 如 `104.9 MB`、`512 B`
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

/**
 * 将 ISO 时间字符串格式化为 `YYYY/MM/DD HH:mm`（东八区）。
 * @param iso ISO 时间字符串或 null
 * @returns 格式化结果，空值返回 `—`
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return DATE_TIME_FORMATTER.format(date);
}
