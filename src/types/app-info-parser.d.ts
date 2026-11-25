declare module "app-info-parser" {
  /** APK 解析结果中本工程用到的字段 */
  export interface ApkInfo {
    package?: string;
    packageName?: string;
    versionCode?: string | number;
    versionName?: string;
    /** 顶层图标：通常是 data:image/png;base64,... */
    icon?: string | Buffer | Uint8Array;
    /** 清单中的 uses-sdk 信息 */
    usesSdk?: {
      minSdkVersion?: string | number;
      targetSdkVersion?: string | number;
    };
    minSdkVersion?: string | number;
    application?: {
      label?: string;
      /** 新版解析器返回资源路径数组，旧版可能返回 base64 图标 */
      icon?: string | string[] | Buffer | Uint8Array;
    };
    [key: string]: unknown;
  }

  /** APK 解析器，传入文件路径或二进制 */
  export default class AppInfoParser {
    constructor(file: string | Buffer);
    parse(): Promise<ApkInfo>;
  }
}
