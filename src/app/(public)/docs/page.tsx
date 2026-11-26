import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CodeTabs, type CodeTab } from "@/components/code-tabs";
import { getRequestOrigin } from "@/server/http/base-url";

/** 文档目录 */
const TOC = [
  { id: "overview", label: "概述" },
  { id: "quick-start", label: "快速开始" },
  { id: "check-api", label: "更新检查接口" },
  { id: "response", label: "响应字段" },
  { id: "semantics", label: "更新语义" },
  { id: "examples", label: "多语言示例" },
  { id: "download", label: "下载与校验" },
  { id: "public-apis", label: "其他公开接口" },
  { id: "errors", label: "错误码与限流" },
  { id: "faq", label: "常见问题" },
];

/** 错误码说明 */
const ERROR_CODES = [
  { code: "VALIDATION_FAILED", status: "400", desc: "参数缺失或格式不正确" },
  { code: "UNAUTHORIZED", status: "401", desc: "需要登录的接口未携带有效会话" },
  { code: "FORBIDDEN", status: "403", desc: "账号无权限访问该资源" },
  { code: "NOT_FOUND", status: "404", desc: "应用不存在、未公开或包名不匹配" },
  { code: "LINK_EXPIRED", status: "410", desc: "下载签名已过期，请重新获取" },
  { code: "RATE_LIMITED", status: "429", desc: "请求过于频繁，稍后重试" },
  { code: "INTERNAL_ERROR", status: "500", desc: "服务器内部错误" },
];

/**
 * 生成多语言示例代码。
 * @param base 站点根地址
 * @returns 语言标签与代码
 */
function buildCodeTabs(base: string): CodeTab[] {
  return [
    {
      id: "curl",
      label: "cURL",
      code: `curl "${base}/api/update/check?packageName=com.example.app&versionCode=12"`,
    },
    {
      id: "java",
      label: "Java",
      code: `String url = BASE_URL + "/api/update/check?packageName="
    + context.getPackageName() + "&versionCode=" + BuildConfig.VERSION_CODE;

OkHttpClient client = new OkHttpClient();
Response response = client.newCall(new Request.Builder().url(url).build()).execute();
JSONObject json = new JSONObject(response.body().string());

if (json.optBoolean("hasUpdate")) {
    JSONObject latest = json.getJSONObject("latest");
    boolean force = json.optBoolean("forceUpdate");
    String apkUrl = latest.getString("downloadUrl");
    String sha256 = latest.getString("sha256");
    // 交给下载器处理；force=true 时禁止跳过更新
}`,
    },
    {
      id: "kotlin",
      label: "Kotlin",
      code: `val url = "$BASE_URL/api/update/check?packageName=" +
    context.packageName + "&versionCode=" + BuildConfig.VERSION_CODE

val body = OkHttpClient()
    .newCall(Request.Builder().url(url).build())
    .execute().body?.string().orEmpty()

val json = JSONObject(body)
if (json.optBoolean("hasUpdate")) {
    val latest = json.getJSONObject("latest")
    val force = json.getBoolean("forceUpdate")
    val apkUrl = latest.getString("downloadUrl")
    val sha256 = latest.getString("sha256")
    // 下载完成后校验 sha256，force=true 时禁止关闭更新弹窗
}`,
    },
    {
      id: "flutter",
      label: "Flutter",
      code: `final info = await PackageInfo.fromPlatform();
final uri = Uri.parse("$BASE_URL/api/update/check").replace(queryParameters: {
  "packageName": info.packageName,
  "versionCode": info.buildNumber,
});

final res = await http.get(uri);
final data = jsonDecode(res.body) as Map<String, dynamic>;
if (data["hasUpdate"] == true) {
  final latest = data["latest"] as Map<String, dynamic>;
  final force = data["forceUpdate"] as bool? ?? false;
  final url = latest["downloadUrl"] as String;
  final sha256 = latest["sha256"] as String;
  // 使用下载插件保存 APK，校验后再触发安装
}`,
    },
    {
      id: "react-native",
      label: "React Native",
      code: `import DeviceInfo from "react-native-device-info";

const url =
  BASE_URL +
  "/api/update/check?packageName=" +
  encodeURIComponent(DeviceInfo.getBundleId()) +
  "&versionCode=" +
  Number(DeviceInfo.getBuildNumber());

const res = await fetch(url);
const data = await res.json();

if (data.hasUpdate) {
  const { downloadUrl, sha256 } = data.latest;
  const force = Boolean(data.forceUpdate);
  // 下载完成后校验 sha256，force 为 true 时禁止跳过
}`,
    },
    {
      id: "node",
      label: "Node.js",
      code: `const base = "https://apps.example.com";
const query = new URLSearchParams({
  packageName: "com.example.app",
  versionCode: String(currentVersionCode),
});

const res = await fetch(base + "/api/update/check?" + query);
if (!res.ok) throw new Error("检查更新失败：" + res.status);

const data = await res.json();
if (data.hasUpdate) {
  console.log("新版本", data.latest.versionName, data.latest.downloadUrl);
  if (data.forceUpdate) {
    // 强制更新：限制核心功能
  }
}`,
    },
    {
      id: "python",
      label: "Python",
      code: `import requests

base = "https://apps.example.com"
resp = requests.get(
    base + "/api/update/check",
    params={"packageName": "com.example.app", "versionCode": current_version_code},
    timeout=10,
)
resp.raise_for_status()
data = resp.json()

if data.get("hasUpdate"):
    latest = data["latest"]
    print("新版本", latest["versionName"], latest["downloadUrl"])
    if data.get("forceUpdate"):
        pass  # 强制更新：引导用户立即升级`,
    },
    {
      id: "go",
      label: "Go",
      code: `package update

import (
    "encoding/json"
    "fmt"
    "net/http"
    "net/url"
)

type Latest struct {
    VersionName string \`json:"versionName"\`
    VersionCode int    \`json:"versionCode"\`
    DownloadURL string \`json:"downloadUrl"\`
    Sha256      string \`json:"sha256"\`
}

type Result struct {
    HasUpdate   bool   \`json:"hasUpdate"\`
    ForceUpdate bool   \`json:"forceUpdate"\`
    Latest      *Latest \`json:"latest"\`
}

func Check(base, pkg string, versionCode int) (*Result, error) {
    endpoint := base + "/api/update/check?" + url.Values{
        "packageName": {pkg},
        "versionCode": {fmt.Sprint(versionCode)},
    }.Encode()

    resp, err := http.Get(endpoint)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result Result
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    return &result, nil
}`,
    },
    {
      id: "csharp",
      label: "C#",
      code: `using System.Net.Http.Json;

public record Latest(
    string VersionName,
    int VersionCode,
    string DownloadUrl,
    string Sha256);

public record UpdateResult(
    bool HasUpdate,
    bool ForceUpdate,
    Latest? Latest);

var url = string.Concat(
    baseUrl,
    "/api/update/check?packageName=",
    Uri.EscapeDataString(packageName),
    "&versionCode=",
    versionCode);

var result = await http.GetFromJsonAsync<UpdateResult>(url);
if (result is { HasUpdate: true, Latest: not null })
{
    var force = result.ForceUpdate;
    // 下载 Latest.DownloadUrl 并用 Latest.Sha256 校验
}`,
    },
  ];
}

/**
 * 文档数据区。
 * @returns 文档内容
 */
async function DocsContent() {
  await connection();

  const base = await getRequestOrigin();
  const tabs = buildCodeTabs(base);
  const checkUrl = `${base}/api/update/check`;

  return (
    <div className="page-shell grid flex-1 gap-10 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <p className="text-[11px] font-medium tracking-[0.18em] text-neutral-400 uppercase">目录</p>
          <nav className="mt-3 space-y-1" aria-label="文档目录">
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-2.5 py-1.5 text-[13px] text-neutral-500 transition hover:bg-black/[0.04] hover:text-brand dark:text-neutral-400 dark:hover:bg-white/[0.06]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link href="/apps" className="btn-secondary mt-5 w-full">
            浏览应用
          </Link>
        </div>
      </aside>

      <div className="min-w-0 space-y-5">
        <header>
          <p className="text-[11px] font-medium tracking-[0.18em] text-brand uppercase">开发者文档</p>
          <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.03em] sm:text-[40px]">
            接入更新检查
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            在自己的应用内调用公开接口检查更新。接口无需登录，下载地址为带签名的临时链接；
            本文覆盖接口参数、响应语义、主流语言示例与常见问题。
          </p>
        </header>

        <section id="overview" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">概述</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            站点根地址为 <code className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[12px] dark:bg-white/10">{base}</code>，
            所有接口均为 HTTPS GET，响应体为 JSON。客户端只需在启动或进入首页时调用一次更新检查接口。
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 dark:bg-white/[0.05]">
              <p className="text-[11px] text-neutral-400">鉴权</p>
              <p className="mt-1 text-sm font-medium">公开接口，无需登录</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] px-3.5 py-3 dark:bg-white/[0.05]">
              <p className="text-[11px] text-neutral-400">响应格式</p>
              <p className="mt-1 text-sm font-medium">application/json</p>
            </div>
          </div>
        </section>

        <section id="quick-start" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">快速开始</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            用一行命令验证接口是否可用：
          </p>
          <pre className="code-block mt-3">{`curl "${checkUrl}?packageName=com.example.app&versionCode=12"`}</pre>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            <li>· 仅返回「公开」且「已发布」的 Android 版本，草稿与私有应用不会出现在结果中。</li>
            <li>· 包名必须与上传 APK 时解析出的包名一致，否则返回 404。</li>
            <li>· 同一 IP 每分钟最多 120 次请求，超出返回 429。</li>
          </ul>
        </section>

        <section id="check-api" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">更新检查接口</h2>
          <p className="mt-3 break-all rounded-xl bg-black/[0.03] px-3.5 py-2.5 font-mono text-[12px] dark:bg-white/[0.05]">
            GET {checkUrl}
          </p>

          <h3 className="mt-5 text-sm font-semibold">请求参数</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-black/[0.08] dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">参数</th>
                  <th className="py-2 pr-4 font-medium">类型</th>
                  <th className="py-2 pr-4 font-medium">必填</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600 dark:text-neutral-300">
                <tr className="border-b border-black/[0.05] dark:border-white/[0.08]">
                  <td className="py-2.5 pr-4 font-mono text-[12px]">packageName</td>
                  <td className="py-2.5 pr-4">string</td>
                  <td className="py-2.5 pr-4">是</td>
                  <td className="py-2.5">应用包名，例如 com.example.app</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-mono text-[12px]">versionCode</td>
                  <td className="py-2.5 pr-4">integer</td>
                  <td className="py-2.5 pr-4">是</td>
                  <td className="py-2.5">当前安装包的 versionCode（不是 versionName）</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="response" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">响应字段</h2>
          <p className="mt-2 text-[13px] text-neutral-500 dark:text-neutral-400">
            hasUpdate=false 时 latest 为 null，属于正常状态，可直接忽略。
          </p>
          <pre className="code-block mt-3">{`{
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
    "downloadUrl": "${base}/api/download/xxx?exp=1730000000&sig=...",
    "publishedAt": "2026-11-26T08:00:00.000Z"
  }
}`}</pre>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-black/[0.08] dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">字段</th>
                  <th className="py-2 pr-4 font-medium">类型</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600 dark:text-neutral-300">
                {[
                  ["hasUpdate", "boolean", "是否存在更高版本的正式发布"],
                  ["forceUpdate", "boolean", "是否强制更新，需禁止跳过"],
                  ["reason", "string | null", "服务端补充说明，例如命中了最低支持版本"],
                  ["latest.versionName", "string", "展示给用户的版本名"],
                  ["latest.versionCode", "integer", "用于比较的版本号"],
                  ["latest.changelog", "string", "更新日志，可能包含换行"],
                  ["latest.fileSize", "integer", "APK 字节数"],
                  ["latest.sha256", "string", "APK 的 SHA-256，下载后校验"],
                  ["latest.minSdk", "integer | null", "APK 解析出的最低 Android API"],
                  ["latest.minSupportedVersionCode", "integer | null", "低于该版本时标记为强制更新"],
                  ["latest.downloadUrl", "string", "带签名的下载地址，10 分钟有效"],
                  ["latest.publishedAt", "string", "发布时间（ISO 8601）"],
                ].map(([field, type, desc]) => (
                  <tr key={field} className="border-b border-black/[0.05] last:border-0 dark:border-white/[0.08]">
                    <td className="py-2.5 pr-4 font-mono text-[12px]">{field}</td>
                    <td className="py-2.5 pr-4 text-neutral-500 dark:text-neutral-400">{type}</td>
                    <td className="py-2.5">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="semantics" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">更新语义</h2>
          <ul className="mt-3 space-y-2 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            <li>
              <strong className="font-medium text-neutral-900 dark:text-neutral-100">普通更新</strong>
              ：hasUpdate=true 且 forceUpdate=false，可提示用户选择稍后更新。
            </li>
            <li>
              <strong className="font-medium text-neutral-900 dark:text-neutral-100">强制更新</strong>
              ：forceUpdate=true，或当前 versionCode 低于 latest.minSupportedVersionCode。
              应展示不可取消的提示，并在更新前限制核心功能。
            </li>
            <li>
              <strong className="font-medium text-neutral-900 dark:text-neutral-100">已是最新</strong>
              ：hasUpdate=false，无需任何提示。
            </li>
            <li>
              <strong className="font-medium text-neutral-900 dark:text-neutral-100">下载链接时效</strong>
              ：有效期 10 分钟，过期后请重新调用检查接口获取新链接，不要缓存下载地址。
            </li>
          </ul>
        </section>

        <section id="examples" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">多语言示例</h2>
          <p className="mt-2 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            以下示例均只做接口调用与结果判断，下载与安装请结合各平台方案实现。
          </p>
          <div className="mt-4">
            <CodeTabs tabs={tabs} />
          </div>
        </section>

        <section id="download" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">下载与校验</h2>
          <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            更新检查返回的 downloadUrl 已带签名，可直接下载；若需要自行构造下载地址，可先获取下载短链：
          </p>
          <pre className="code-block mt-3">{`GET ${base}/api/public/releases/{releaseId}/download-ticket`}</pre>
          <ul className="mt-4 space-y-1.5 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            <li>· 下载响应头为 attachment，文件名为版本名。</li>
            <li>· 下载完成后计算 SHA-256，与 latest.sha256 比对，不一致时丢弃文件。</li>
            <li>· 签名过期返回 410 LINK_EXPIRED，重新调用检查接口即可。</li>
            <li>· 下载统计在成功响应下载文件时累计。</li>
          </ul>
        </section>

        <section id="public-apis" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">其他公开接口</h2>
          <div className="mt-3 divide-y divide-black/[0.05] text-[13px] dark:divide-white/[0.08]">
            {[
              ["GET /api/public/apps", "公开应用列表，支持 q、type、category、tag、sort 参数"],
              ["GET /api/public/apps/{slug}", "应用详情，含截图、当前版本与历史版本"],
              ["GET /api/public/apps/{slug}/releases", "应用已发布的版本列表"],
              ["GET /api/public/releases/{id}/download-ticket", "获取带时效签名的下载短链"],
              ["GET /api/openapi", "完整的 OpenAPI 3.1 描述，可导入调试工具"],
            ].map(([path, desc]) => (
              <div key={path} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <code className="font-mono text-[12px] text-neutral-800 dark:text-neutral-200">{path}</code>
                <span className="text-neutral-500 dark:text-neutral-400">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="errors" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">错误码与限流</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead className="text-neutral-500 dark:text-neutral-400">
                <tr className="border-b border-black/[0.08] dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">错误码</th>
                  <th className="py-2 pr-4 font-medium">HTTP</th>
                  <th className="py-2 font-medium">说明</th>
                </tr>
              </thead>
              <tbody className="text-neutral-600 dark:text-neutral-300">
                {ERROR_CODES.map((row) => (
                  <tr key={row.code} className="border-b border-black/[0.05] last:border-0 dark:border-white/[0.08]">
                    <td className="py-2.5 pr-4 font-mono text-[12px]">{row.code}</td>
                    <td className="py-2.5 pr-4">{row.status}</td>
                    <td className="py-2.5">{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            更新检查接口单 IP 每分钟最多 120 次请求；登录接口连续失败 5 次将锁定 5 分钟。
            建议客户端在启动时检查一次，并在应用回到前台时按需重试。
          </p>
        </section>

        <section id="faq" className="surface scroll-mt-24 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">常见问题</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium">为什么返回 404？</dt>
              <dd className="mt-1 leading-7 text-neutral-500 dark:text-neutral-400">
                常见原因是包名与上传 APK 不一致、应用未公开，或还没有已发布的正式版本。
              </dd>
            </div>
            <div>
              <dt className="font-medium">可以用 versionName 比较版本吗？</dt>
              <dd className="mt-1 leading-7 text-neutral-500 dark:text-neutral-400">
                不可以。请使用 versionCode，服务端按整数比较，versionName 仅用于展示。
              </dd>
            </div>
            <div>
              <dt className="font-medium">下载地址可以缓存吗？</dt>
              <dd className="mt-1 leading-7 text-neutral-500 dark:text-neutral-400">
                不建议。签名 10 分钟后过期，每次更新流程都应重新获取。
              </dd>
            </div>
            <div>
              <dt className="font-medium">如何成为开发者？</dt>
              <dd className="mt-1 leading-7 text-neutral-500 dark:text-neutral-400">
                开发者账号由管理员在后台创建。拿到账号后使用统一登录入口进入开发者控制台。
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}

/**
 * 文档页骨架。
 * @returns 占位结构
 */
function DocsSkeleton() {
  return (
    <div className="page-shell flex flex-1 animate-pulse gap-10 py-10 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="hidden h-64 rounded-2xl bg-black/[0.05] lg:block dark:bg-white/[0.07]" />
      <div className="min-w-0 space-y-4">
        <div className="h-10 w-56 rounded-xl bg-black/[0.06] dark:bg-white/10" />
        <div className="h-40 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        <div className="h-64 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
      </div>
    </div>
  );
}

/**
 * 公开接入文档页。
 * @returns 页面内容
 */
export default function DocsPage() {
  return (
    <Suspense fallback={<DocsSkeleton />}>
      <DocsContent />
    </Suspense>
  );
}
