/**
 * 公开接口冒烟测试（Node 22 内置 fetch）。
 * 前置：已执行 scripts/smoke-seed.ts 并启动 npm start。
 * 用法：node scripts/api-smoke.mjs [baseUrl]
 */
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";

let passed = 0;

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
 * 获取 JSON 响应并校验状态码。
 * @param {string} path 请求路径
 * @param {number} expected 期望状态码
 * @returns {Promise<any>} 解析后的 JSON
 */
async function getJson(path, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  if (response.status !== expected) {
    throw new Error(`FAIL: ${path} 期望 ${expected}，实际 ${response.status}`);
  }
  return response.json();
}

console.log("== 公开接口冒烟测试 ==");

const list = await getJson("/api/public/apps");
assert(list.total >= 1, "列表返回至少 1 个应用");
const card = list.items[0];
assert(typeof card.slug === "string" && card.slug.length > 0, "列表项包含 slug");

const detail = await getJson(`/api/public/apps/${card.slug}`);
assert(detail.currentRelease !== null, "详情包含当前版本");
assert(typeof detail.packageName === "string", "详情包含包名");

const check = await getJson(
  `/api/update/check?packageName=${encodeURIComponent(detail.packageName)}&versionCode=0`,
);
assert(check.hasUpdate === true, "低版本检出更新");
assert(/sig=[0-9a-f]{64}/.test(check.latest.downloadUrl), "更新结果含签名下载地址");

const same = await getJson(
  `/api/update/check?packageName=${encodeURIComponent(detail.packageName)}&versionCode=${detail.currentRelease.versionCode}`,
);
assert(same.hasUpdate === false, "同版本无更新");

const unknown = await getJson("/api/update/check?packageName=com.unknown.app&versionCode=1");
assert(unknown.reason === "NOT_FOUND" && unknown.hasUpdate === false, "未知包名返回 NOT_FOUND 且为 200");

const ticket = await getJson(`/api/public/releases/${detail.currentRelease.id}/download-ticket`);
assert(/sig=[0-9a-f]{64}/.test(ticket.path), "下载票据包含 64 位签名");

const first = await fetch(`${baseUrl}${ticket.path}`, { headers: { Range: "bytes=0-1023" } });
assert(first.status === 206, "Range 请求返回 206");
// Next 对流式响应使用 chunked 编码，不保留 Content-Length，改为校验实际字节数
assert((await first.arrayBuffer()).byteLength === 1024, "Range 响应体为 1024 字节");
assert((first.headers.get("content-range") ?? "").startsWith("bytes 0-1023/"), "Content-Range 头正确");
assert(first.headers.get("accept-ranges") === "bytes", "声明支持断点续传");

const second = await fetch(`${baseUrl}${ticket.path}`, { headers: { Range: "bytes=1024-2047" } });
assert(second.status === 206, "第二段 Range 返回 206");
assert((await second.arrayBuffer()).byteLength === 1024, "第二段响应体为 1024 字节");
assert((second.headers.get("content-range") ?? "").startsWith("bytes 1024-2047/"), "第二段 Content-Range 头正确");

const zeroSig = ticket.path.replace(/sig=[0-9a-f]+/, `sig=${"0".repeat(64)}`);
const tampered = await fetch(`${baseUrl}${zeroSig}`);
assert(tampered.status === 403, "篡改签名返回 403");

const outOfRange = await fetch(`${baseUrl}${ticket.path}`, { headers: { Range: "bytes=999999999-" } });
assert(outOfRange.status === 416, "越界 Range 返回 416");

console.log(`== 冒烟测试全部通过（${passed} 项）==`);
