/** 应用类型：Android 应用 / 网页作品 */
export const APP_TYPES = ["ANDROID", "WEB"] as const;
export type AppType = (typeof APP_TYPES)[number];

/** 可见性：公开 / 仅管理员可见 */
export const VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** 版本状态：草稿 / 已发布 / 已归档 */
export const RELEASE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

/** 下载链接签名有效期（秒） */
export const SIGN_TTL_SECONDS = 600;

/** 管理后台会话有效期（秒），7 天 */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** 会话 Cookie 名称 */
export const SESSION_COOKIE = "appstore_session";

/** 开发者门户会话 Cookie 名称 */
export const DEVELOPER_SESSION_COOKIE = "appstore_dev_session";

/** 开发者账号状态：启用 / 停用 */
export const DEVELOPER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type DeveloperStatus = (typeof DEVELOPER_STATUSES)[number];

/** 图标统一尺寸（像素） */
export const ICON_SIZE = 512;

/** 图标上传上限 */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;

/** 单张截图上上限 */
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

/** 登录失败限流：窗口内最多尝试次数与窗口长度 */
export const LOGIN_RATE_LIMIT = { maxFailures: 5, windowMs: 5 * 60 * 1000 };

/** 详情页返回的历史版本条数上限 */
export const MAX_RELEASES_IN_DETAIL = 20;
