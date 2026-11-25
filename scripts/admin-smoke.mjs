/**
 * 管理接口冒烟测试（Node 22 内置 fetch）。
 * 前置：已执行 npm run init-admin 并启动 npm start；APK 路径可通过 SMOKE_APK 覆盖。
 * 用法：node scripts/admin-smoke.mjs [baseUrl]
 */
import "dotenv/config";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const apkPath = process.env.SMOKE_APK ?? "C:\\Code\\PackKeeper\\dist\\包裹管家-1.0.0-4026.apk";
const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "";

/** 1×1 PNG，用于图标与截图上传 */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const PUBLIC_SLUG = "admin-smoke";
const PRIVATE_SLUG = "admin-smoke-private";

let passed = 0;
let cookie = "";

/**
 * 断言条件成立，否则抛出错误。
 * @param {boolean} condition 断言条件
 * @param {string} message 断言描述
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  passed += 1;
  console.log(`PASS: ${message}`);
}

/**
 * 发送请求并返回响应。
 * @param {string} path 请求路径
 * @param {object} options method / body / headers / auth
 * @returns {Promise<Response>} 响应
 */
async function request(path, { method = "GET", body, headers = {}, auth = true } = {}) {
  const finalHeaders = { ...headers };
  if (auth && cookie) finalHeaders.Cookie = cookie;
  const isStream = body instanceof ReadableStream;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    body,
    headers: finalHeaders,
    ...(isStream ? { duplex: "half" } : {}),
  });
  return response;
}

/**
 * 校验响应状态码。
 * @param {Response} response 响应
 * @param {number} expected 期望状态码
 * @param {string} label 描述
 * @returns {Promise<any>} 状态匹配时返回解析后的 JSON（无内容返回 null）
 */
async function expect(response, expected, label) {
  if (response.status !== expected) {
    const text = await response.text().catch(() => "");
    throw new Error(`FAIL: ${label} 期望 ${expected}，实际 ${response.status} ${text.slice(0, 200)}`);
  }
  passed += 1;
  console.log(`PASS: ${label}`);
  const type = response.headers.get("content-type") ?? "";
  return type.includes("application/json") ? response.json() : null;
}

/**
 * 从登录响应中提取会话 Cookie。
 * @param {Response} response 登录响应
 * @returns {string} Cookie 键值对
 */
function extractCookie(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  const session = setCookies.find((item) => item.startsWith("appstore_session="));
  if (!session) throw new Error("FAIL: 登录响应未下发会话 Cookie");
  return session.split(";")[0];
}

/**
 * 删除遗留的冒烟应用，保证脚本可重复执行。
 * @returns {Promise<void>}
 */
async function cleanupStaleApps() {
  const response = await request("/api/admin/apps");
  if (response.status !== 200) return;
  const list = await response.json();
  for (const item of list.items) {
    if (item.slug === PUBLIC_SLUG || item.slug === PRIVATE_SLUG) {
      await request(`/api/admin/apps/${item.id}`, { method: "DELETE" });
    }
  }
}

console.log("== 管理接口冒烟测试 ==");

// 未登录守卫
await expect(await request("/api/admin/apps", { auth: false }), 401, "未登录访问后台列表返回 401");
await expect(
  await request("/api/admin/apps", { method: "POST", auth: false, body: JSON.stringify({}) }),
  401,
  "未登录创建应用返回 401",
);

// 登录限流：使用独立来源地址，避免影响后续登录
for (let i = 1; i <= 5; i += 1) {
  const response = await request("/api/admin/login", {
    method: "POST",
    auth: false,
    headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
    body: JSON.stringify({ username, password: `${password}-wrong` }),
  });
  assert(response.status === 401, `第 ${i} 次错误密码返回 401`);
}
const limited = await request("/api/admin/login", {
  method: "POST",
  auth: false,
  headers: { "content-type": "application/json", "x-forwarded-for": "10.9.9.9" },
  body: JSON.stringify({ username, password: `${password}-wrong` }),
});
assert(limited.status === 429, "同一来源第 6 次登录失败返回 429");

// 正确登录
const loginResponse = await request("/api/admin/login", {
  method: "POST",
  auth: false,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username, password }),
});
await expect(loginResponse.clone(), 200, "正确账号密码登录成功");
cookie = extractCookie(loginResponse);
assert(cookie.length > 0, "登录后获得会话 Cookie");

await cleanupStaleApps();

// 创建公开 Android 应用
const created = await (
  await request("/api/admin/apps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: PUBLIC_SLUG,
      name: "冒烟测试应用",
      summary: "管理接口冒烟用",
      type: "ANDROID",
      category: "工具",
      tags: ["smoke"],
      packageName: "com.packkeeper.packkeeper",
    }),
  })
).json();
assert(typeof created.id === "string", "创建 Android 应用成功");

// 非 ZIP 文件应被拒绝
const invalid = await request(`/api/admin/apps/${created.id}/releases`, {
  method: "POST",
  headers: { "content-type": "application/octet-stream" },
  body: new Blob([Buffer.from("not-an-apk")], { type: "application/octet-stream" }),
});
assert(invalid.status === 415, "上传非 APK 文件返回 415");

// 上传真实 APK
const size = (await fs.stat(apkPath)).size;
const uploadResponse = await request(`/api/admin/apps/${created.id}/releases`, {
  method: "POST",
  headers: {
    "content-type": "application/octet-stream",
    "content-length": String(size),
    "x-version-changelog": encodeURIComponent("- 首个版本"),
  },
  body: Readable.toWeb(createReadStream(apkPath)),
});
const uploaded = await expect(uploadResponse, 201, "上传真实 APK 返回 201");
assert(uploaded.parsed.versionCode === 4026, "解析 versionCode 为 4026");
assert(uploaded.parsed.packageName === "com.packkeeper.packkeeper", "解析包名正确");
assert(uploaded.release.status === "DRAFT", "上传后版本为草稿");
assert(uploaded.release.changelog === "- 首个版本", "更新日志请求头解码正确");

// 重复上传同一版本应冲突
const duplicateResponse = await request(`/api/admin/apps/${created.id}/releases`, {
  method: "POST",
  headers: {
    "content-type": "application/octet-stream",
    "content-length": String(size),
  },
  body: Readable.toWeb(createReadStream(apkPath)),
});
const duplicate = await expect(duplicateResponse, 409, "重复版本返回 409");
assert(duplicate.error.code === "VERSION_CONFLICT", "重复版本错误码为 VERSION_CONFLICT");

// 发布
const published = await (
  await request(`/api/admin/releases/${uploaded.release.id}/publish`, { method: "POST" })
).json();
assert(published.status === "PUBLISHED" && published.isCurrent === true, "发布后版本为已发布且当前");

// 归档当前版本应被拒绝
const archiveCurrent = await request(`/api/admin/releases/${uploaded.release.id}/archive`, {
  method: "POST",
});
const archiveError = await archiveCurrent.json();
assert(
  archiveCurrent.status === 400 && archiveError.error.code === "VALIDATION_FAILED",
  "归档当前版本返回 400",
);

// 前台与更新接口可见
const publicList = await (await request("/api/public/apps", { auth: false })).json();
assert(
  publicList.items.some((item) => item.slug === PUBLIC_SLUG),
  "公开列表包含新应用",
);
const check = await (
  await request("/api/update/check?packageName=com.packkeeper.packkeeper&versionCode=0", { auth: false })
).json();
assert(check.hasUpdate === true, "更新接口检出新版本");

// 图标上传
const iconForm = new FormData();
iconForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "icon.png");
const icon = await (
  await request(`/api/admin/apps/${created.id}/icon`, { method: "POST", body: iconForm })
).json();
assert(icon.iconUrl === `/api/assets/icons/${created.id}.png`, "图标上传返回访问地址");
const iconAsset = await request(icon.iconUrl, { auth: false });
assert(iconAsset.status === 200, "公开应用图标可匿名访问");
assert(iconAsset.headers.get("content-type") === "image/png", "图标响应类型为 image/png");

// 截图上传与删除
const shotForm = new FormData();
shotForm.append("file", new Blob([TINY_PNG], { type: "image/png" }), "shot.png");
const shot = await (
  await request(`/api/admin/apps/${created.id}/screenshots`, { method: "POST", body: shotForm })
).json();
assert(shot.screenshots.length === 1, "截图上传后数量为 1");
const detail = await (
  await request(`/api/public/apps/${PUBLIC_SLUG}`, { auth: false })
).json();
assert(detail.screenshots.length === 1, "详情页返回 1 张截图");
const afterDelete = await (
  await request(`/api/admin/apps/${created.id}/screenshots?index=0`, { method: "DELETE" })
).json();
assert(afterDelete.screenshots.length === 0, "删除截图后数量为 0");

// 私有网页作品
const privateApp = await (
  await request("/api/admin/apps", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      slug: PRIVATE_SLUG,
      name: "私有网页作品",
      summary: "仅管理员可见",
      type: "WEB",
      category: "网页",
      webUrl: "http://example.com",
      visibility: "PRIVATE",
    }),
  })
).json();
assert(privateApp.visibility === "PRIVATE", "创建私有网页作品成功");
const publicAfterPrivate = await (await request("/api/public/apps", { auth: false })).json();
assert(
  !publicAfterPrivate.items.some((item) => item.slug === PRIVATE_SLUG),
  "公开列表不包含私有应用",
);
const adminList = await (await request("/api/admin/apps")).json();
const privateCard = adminList.items.find((item) => item.slug === PRIVATE_SLUG);
assert(privateCard?.visibility === "PRIVATE", "后台列表包含私有应用并标记可见性");
assert(
  (await request(`/api/assets/screenshots/${privateApp.id}/x.png`, { auth: false })).status === 401,
  "未登录读取私有应用资源返回 401",
);
assert(
  (await request(`/api/assets/screenshots/${privateApp.id}/x.png`)).status === 404,
  "登录后读取不存在的私有资源返回 404",
);

// 删除应用并校验磁盘清理
await expect(await request(`/api/admin/apps/${created.id}`, { method: "DELETE" }), 204, "删除公开应用返回 204");
await expect(
  await request(`/api/admin/apps/${privateApp.id}`, { method: "DELETE" }),
  204,
  "删除私有应用返回 204",
);
const publicFinal = await (await request("/api/public/apps", { auth: false })).json();
assert(
  !publicFinal.items.some((item) => item.slug === PUBLIC_SLUG),
  "删除后公开列表不再包含该应用",
);
const apkDirRemoved = await fs.access(`${process.cwd()}\\storage\\apks\\${created.id}`).then(
  () => false,
  () => true,
);
assert(apkDirRemoved, "删除应用后 APK 目录已清理");

// 登出
const logoutResponse = await request("/api/admin/logout", { method: "POST" });
await expect(logoutResponse.clone(), 200, "登出成功");
const cleared = (logoutResponse.headers.getSetCookie?.() ?? []).find((item) =>
  item.startsWith("appstore_session="),
);
assert((cleared ?? "").includes("Max-Age=0"), "登出清除会话 Cookie");

console.log(`== 管理接口冒烟测试全部通过（${passed} 项）==`);
