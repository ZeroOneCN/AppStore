/** ZIP 本地文件头（PK\x03\x04），APK 文件应以它开头 */
const ZIP_HEADER = [0x50, 0x4b, 0x03, 0x04];
/** ZIP 中央目录结束记录（PK\x05\x06），文件完整时一定存在于尾部 */
const ZIP_EOCD = [0x50, 0x4b, 0x05, 0x06];
/** EOCD 记录最长 22 字节，加上最多 65535 字节注释，尾部扫描 66KB 足够 */
const EOCD_SCAN_BYTES = 66 * 1024;

/**
 * 上传前快速校验 APK 是否完整：检查 ZIP 文件头与尾部中央目录结束记录。
 * 只读取文件首尾少量字节，不解析内容，用于在客户端提前拦截复制或下载中断产生的残缺文件。
 * @param file 用户选择的文件
 * @returns 校验通过返回 null，否则返回可直接展示的错误文案
 */
export async function checkApkFile(file: File): Promise<string | null> {
  if (file.size < 1024) {
    return "文件过小，不是有效的 APK";
  }

  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (!ZIP_HEADER.every((byte, index) => head[index] === byte)) {
    return "不是有效的 APK（缺少 ZIP 文件头）";
  }

  const tailLength = Math.min(file.size, EOCD_SCAN_BYTES);
  const tail = new Uint8Array(await file.slice(file.size - tailLength).arrayBuffer());
  for (let index = tail.length - 22; index >= 0; index -= 1) {
    if (ZIP_EOCD.every((byte, offset) => tail[index + offset] === byte)) {
      return null;
    }
  }

  return "安装包不完整（缺少 ZIP 目录），请重新选择安装包后再试；如果文件刚生成或仍在复制，请等待写入完成";
}
