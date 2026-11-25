/// 将字节数格式化为易读文本。
///
/// 非法或非正数按 `0 B` 处理，结果最多保留一位小数。
String formatBytes(int bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  var value = bytes.toDouble();
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  final digits = unitIndex == 0 || value >= 100 ? 0 : 1;
  return '${value.toStringAsFixed(digits)} ${units[unitIndex]}';
}

/// 将 ISO 时间字符串格式化为 `YYYY/MM/DD HH:mm`（本地时区）。
///
/// 空值或无法解析时返回 `—`。
String formatDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return '—';
  final parsed = DateTime.tryParse(iso);
  if (parsed == null) return '—';
  final local = parsed.toLocal();
  String two(int value) => value.toString().padLeft(2, '0');
  return '${local.year}/${two(local.month)}/${two(local.day)} ${two(local.hour)}:${two(local.minute)}';
}

/// 将下载进度换算为百分比文本。
String formatPercent(int received, int total) {
  if (total <= 0) return '—';
  final percent = (received / total * 100).clamp(0, 100);
  return '${percent.toStringAsFixed(0)}%';
}
