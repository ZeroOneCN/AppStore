/** 后台页面传给客户端组件的应用数据（已序列化） */
export interface AdminAppData {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  type: "ANDROID" | "WEB";
  category: string;
  tags: string[];
  webUrl: string | null;
  packageName: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  pinned: boolean;
  iconUrl: string | null;
  screenshots: string[];
}

/** 后台版本数据（已序列化） */
export interface AdminReleaseData {
  id: string;
  versionName: string;
  versionCode: number;
  changelog: string;
  fileSize: number;
  sha256: string;
  minSdk: number | null;
  forceUpdate: boolean;
  minSupportedVersionCode: number | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isCurrent: boolean;
  publishedAt: string | null;
  createdAt: string;
}
