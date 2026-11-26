import { connection } from "next/server";
import { Suspense } from "react";
import { requireDeveloperPage } from "@/server/http/guards";

/** 代码块样式 */
const CODE_CLASS =
  "overflow-x-auto rounded-xl bg-neutral-950 px-4 py-3 text-[12px] leading-6 text-neutral-100 dark:bg-black/60";

/** 接口说明卡片样式 */
const SECTION_CLASS =
  "rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900";

/**
 * 更新检查接入文档数据区。
 * @returns 文档内容
 */
async function DeveloperDocsContent() {
  await connection();
  await requireDeveloperPage();

  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const endpoint = `${baseUrl}/api/update/check`;

  return (
    <div className="w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">接入更新检查</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          在自己的应用内调用公开接口检查更新，下载地址为带签名的临时链接，无需登录
        </p>
      </div>

      <section className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold">接口地址</h2>
        <p className="mt-2 break-all rounded-lg bg-neutral-100 px-3 py-2 font-mono text-xs dark:bg-neutral-800">
          GET {endpoint}?packageName=你的包名&amp;versionCode=当前版本号
        </p>
        <ul className="mt-3 space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <li>· 仅返回「公开」且「已发布」的 Android 版本；草稿与私有应用不返回。</li>
          <li>· 包名必须与上传 APK 时解析出的包名一致，否则返回 NOT_FOUND。</li>
          <li>· 单 IP 每分钟最多 120 次请求，超出返回 429。</li>
        </ul>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold">请求参数</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="text-neutral-500 dark:text-neutral-400">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-2 pr-4 font-medium">参数</th>
                <th className="py-2 pr-4 font-medium">类型</th>
                <th className="py-2 pr-4 font-medium">必填</th>
                <th className="py-2 font-medium">说明</th>
              </tr>
            </thead>
            <tbody className="text-neutral-600 dark:text-neutral-300">
              <tr className="border-b border-neutral-100 dark:border-neutral-800/70">
                <td className="py-2 pr-4 font-mono">packageName</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2 pr-4">是</td>
                <td className="py-2">应用包名，例如 com.example.app</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono">versionCode</td>
                <td className="py-2 pr-4">integer</td>
                <td className="py-2 pr-4">是</td>
                <td className="py-2">当前安装包的 versionCode（不是 versionName）</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold">响应示例</h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          hasUpdate=false 表示已是最新或应用未收录，可安全忽略 latest 为 null 的情况。
        </p>
        <pre className={`${CODE_CLASS} mt-3`}>{`{
  "hasUpdate": true,
  "forceUpdate": false,
  "reason": null,
  "latest": {
    "versionName": "1.2.0",
    "versionCode": 12,
    "changelog": "修复导入崩溃\\n优化列表加载",
    "fileSize": 52428800,
    "sha256": "9f2c...e1",
    "minSdk": 24,
    "minSupportedVersionCode": 8,
    "downloadUrl": "${baseUrl}/api/download/xxx?exp=1730000000&sig=...",
    "publishedAt": "2026-11-26T08:00:00.000Z"
  }
}`}</pre>
        <ul className="mt-3 space-y-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <li>· forceUpdate=true 时建议弹不可取消的更新提示，未更新前限制核心功能。</li>
          <li>· downloadUrl 有效期 10 分钟，且为附件下载地址；应用内请重新检查获取新链接。</li>
          <li>· 下载完成后可用 sha256 校验文件完整性，校验通过后再触发安装。</li>
        </ul>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold">Kotlin（OkHttp）示例</h2>
        <pre className={`${CODE_CLASS} mt-3`}>{`data class Latest(
  val versionName: String,
  val versionCode: Int,
  val changelog: String,
  val downloadUrl: String,
)

val url = "${endpoint}?packageName=" +
  context.packageName + "&versionCode=" + BuildConfig.VERSION_CODE

val body = OkHttpClient().newCall(Request.Builder().url(url).build())
  .execute().body?.string().orEmpty()

val json = JSONObject(body)
if (json.optBoolean("hasUpdate")) {
  val latest = json.getJSONObject("latest")
  val force = json.getBoolean("forceUpdate")
  val apkUrl = latest.getString("downloadUrl")
  // 交给下载器处理，force=true 时禁止跳过
}`}</pre>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="text-sm font-semibold">Flutter（http）示例</h2>
        <pre className={`${CODE_CLASS} mt-3`}>{`final uri = Uri.parse("${endpoint}").replace(queryParameters: {
  "packageName": "com.example.app",
  "versionCode": (await PackageInfo.fromPlatform()).buildNumber,
});

final res = await http.get(uri);
final data = jsonDecode(res.body) as Map<String, dynamic>;
if (data["hasUpdate"] == true) {
  final latest = data["latest"] as Map<String, dynamic>;
  final force = data["forceUpdate"] as bool? ?? false;
  final url = latest["downloadUrl"] as String;
  // 使用下载插件保存 APK，force 为 true 时禁止关闭更新弹窗
}`}</pre>
      </section>
    </div>
  );
}

/**
 * 开发者接入文档页。
 * @returns 页面内容
 */
export default function DeveloperDocsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-4xl animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-40 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
          <div className="h-56 rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        </div>
      }
    >
      <DeveloperDocsContent />
    </Suspense>
  );
}
