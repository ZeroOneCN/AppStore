declare module "app-info-parser" {
  /** 解析结果中与 APK 相关的字段（仅声明本工程用到的部分） */
  export interface ApkInfo {
    package?: string;
    packageName?: string;
    versionCode?: string | number;
    versionName?: string;
    minSdkVersion?: string | number;
    application?: {
      label?: string;
      icon?: string | Buffer | Uint8Array;
    };
    [key: string]: unknown;
  }

  /** APK 解析器，传入文件路径或二进制 */
  export default class AppInfoParser {
    constructor(file: string | Buffer);
    parse(): Promise<ApkInfo>;
  }
}
