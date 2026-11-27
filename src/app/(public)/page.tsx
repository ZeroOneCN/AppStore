import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppCard } from "@/components/app-card";
import { CodeTabs } from "@/components/code-tabs";
import { StatCard } from "@/components/stat-card";
import { getRequestOrigin } from "@/server/http/base-url";
import { listPublicApps } from "@/server/services/app.service";
import { getSiteSettings } from "@/server/services/settings.service";

/** 平台能力列表 */
const CAPABILITIES = [
  {
    title: "自动解析 APK",
    description: "上传安装包即解析包名、版本号与最低系统，无需手工填写。",
    path: "M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7ZM3 8.5 12 14l9-5.5M12 14v7",
  },
  {
    title: "版本回滚",
    description: "保留历史版本，随时切换当前版本，客户端获取始终一致。",
    path: "M3 12a9 9 0 1 0 3-6.7M3 4v5h5",
  },
  {
    title: "更新检查 API",
    description: "一个 GET 接口返回是否有更新、强制更新标记与下载地址。",
    path: "m9 8-4 4 4 4m6-8 4 4-4 4",
  },
  {
    title: "账号权限分级",
    description: "管理员与开发者共用登录入口，会话角色自动隔离可见范围。",
    path: "M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Zm-3 9 2 2 4-4",
  },
  {
    title: "私有应用",
    description: "按应用设置可见性，草稿与私有版本不会出现在公开接口。",
    path: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5V11Z",
  },
  {
    title: "签名下载",
    description: "下载链接带时效签名，防止被长期外链与恶意抓取。",
    path: "M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 0 1 5.7 5.7L16.7 13M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 0 1-5.7-5.7L7.3 11",
  },
];

/** 三步接入指引 */
const STEPS = [
  {
    title: "创建应用",
    description: "填写名称、包名与分类，Android 应用会在上传后自动补全版本信息。",
  },
  {
    title: "上传 APK",
    description: "上传安装包即可发布为当前版本，可附加更新日志与强制更新标记。",
  },
  {
    title: "客户端接入",
    description: "在应用内调用更新检查接口，按返回结果提示下载并校验 SHA-256。",
  },
];

/**
 * 首页数据区：读取公开应用并渲染宣传内容。
 * @returns 首页主体
 */
async function HomeContent() {
  await connection();
  const apps = await listPublicApps({ sort: "recent" });

  const featured = apps.slice(0, 6);
  const androidCount = apps.filter((app) => app.type === "ANDROID").length;
  const webCount = apps.length - androidCount;
  const downloads = apps.reduce((sum, app) => sum + app.downloadCount, 0);
  const { siteName } = await getSiteSettings();
  const origin = await getRequestOrigin();
  const checkEndpoint = `${origin}/api/update/check`;

  /** 一行接入示例：复制后替换包名与版本号即可使用 */
  const integrationSnippets = [
    {
      id: "js",
      label: "JavaScript",
      code: `fetch("${checkEndpoint}?packageName=com.example.app&versionCode=12").then((r) => r.json()).then(console.log);`,
    },
    {
      id: "curl",
      label: "cURL",
      code: `curl "${checkEndpoint}?packageName=com.example.app&versionCode=12"`,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/* Hero：大标题、行动按钮与右侧接口预览 */}
      <section className="page-shell relative overflow-hidden pt-10 pb-8 sm:pt-16 sm:pb-12">
        <div className="hero-glow -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0">
            <span className="chip">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              应用分发中心 · 已收录 {apps.length} 个应用
            </span>
            <h1 className="mt-4 text-[36px] leading-[1.06] font-semibold tracking-[-0.035em] sm:text-[54px]">
              把应用分发
              <br />
              <span className="gradient-text">做成自己的商店</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-neutral-600 dark:text-neutral-300">
              {siteName} 托管 Android 安装包与网页作品，提供版本管理、历史回滚、签名下载与客户端更新检查。
              数据存储在自建服务器上，无需依赖第三方应用市场。
            </p>

            <div className="btn-group mt-6 max-w-md">
              <Link href="/apps" className="btn-primary py-3 text-[14px]">
                浏览应用
              </Link>
              <Link href="/docs" className="btn-secondary py-3 text-[14px]">
                查看接入文档
              </Link>
            </div>

            <dl className="mt-8 grid max-w-xl grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCard label="应用" value={apps.length} tone="brand" />
              <StatCard label="累计下载" value={downloads} />
              <StatCard label="Android" value={androidCount} />
              <StatCard label="网页作品" value={webCount} />
            </dl>
          </div>

          <div className="relative min-w-0">
            <div className="surface p-5 sm:p-6" style={{ boxShadow: "var(--shadow-float)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">接入更新检查，一行就够</p>
                <div className="flex items-center gap-1.5">
                  <span className="chip">无需 SDK</span>
                  <span className="chip">GET</span>
                </div>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                替换包名与版本号，复制到项目里即可拿到更新信息。
              </p>

              <div className="mt-3">
                <CodeTabs tabs={integrationSnippets} />
              </div>

              <p className="mt-4 text-[11px] text-neutral-400">返回示例</p>
              <pre className="code-block mt-1.5 text-[11px]">{`{
  "hasUpdate": true,
  "forceUpdate": false,
  "latest": {
    "versionName": "1.2.0",
    "versionCode": 12,
    "downloadUrl": "/api/download/xxx?exp=...&sig=..."
  }
}`}</pre>
              <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>下载链接 10 分钟有效</span>
                <Link href="/docs" className="shrink-0 font-medium text-brand transition hover:text-brand-deep">
                  完整接入文档 →
                </Link>
              </div>
            </div>

            <div className="hero-glow -right-16 -bottom-16 h-56 w-56 opacity-70" />
          </div>
        </div>
      </section>

      {/* 精选应用 */}
      <section className="page-shell mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">精选应用</h2>
            <p className="page-desc">共 {apps.length} 个作品 · 置顶与最近更新优先，点击查看详情与历史版本</p>
          </div>
          <Link href="/apps" className="text-sm font-medium text-brand transition hover:text-brand-deep">
            查看全部 →
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="empty-state mt-4">
            <p className="text-base font-medium">还没有发布应用</p>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              登录控制台上传第一个应用后，这里会自动展示
            </p>
            <Link href="/login" className="btn-primary mt-5">
              进入控制台
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid auto-rows-fr gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {featured.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </section>

      {/* 平台能力 */}
      <section className="page-shell mt-16">
        <div className="max-w-2xl">
          <h2 className="section-title">为分发而生的基础设施</h2>
          <p className="page-desc">
            从上传解析到客户端更新，一条链路覆盖个人开发者与小团队最常见的分发需求。
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="surface p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={item.path} />
                </svg>
              </span>
              <h3 className="mt-4 text-[15px] font-semibold">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 接入流程 */}
      <section className="page-shell mt-16">
        <div className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <h2 className="section-title">三步接入</h2>
            <p className="page-desc">
              控制台完成发布，客户端只需一次 GET 请求即可获得更新信息。
            </p>
            <Link href="/docs" className="btn-secondary mt-5">
              阅读完整接入文档
            </Link>
          </div>

          <ol className="grid gap-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-2xl bg-black/[0.025] p-4 dark:bg-white/[0.04]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 底部行动区 */}
      <section className="page-shell mt-16">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0b0d12] px-6 py-12 text-center text-white sm:px-10">
          <div className="hero-glow -top-24 left-1/2 h-64 w-[420px] -translate-x-1/2 bg-brand/40" />
          <div className="relative">
            <h2 className="text-[26px] font-semibold tracking-tight sm:text-[32px]">
              开始管理自己的应用分发
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-neutral-300">
              管理员与开发者使用同一登录入口，登录后按账号角色进入对应控制台。
            </p>
            <div className="btn-group mx-auto mt-7 max-w-md">
              <Link
                href="/login"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-medium text-neutral-900 transition hover:bg-neutral-100"
              >
                登录控制台
              </Link>
              <Link
                href="/docs"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-white/20 px-5 py-3 text-sm text-white transition hover:bg-white/10"
              >
                查看接入文档
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * 首页骨架屏。
 * @returns 占位结构
 */
function HomeSkeleton() {
  return (
    <div className="page-shell flex flex-1 animate-pulse flex-col pt-16">
      <div className="h-6 w-40 rounded-full bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-6 h-28 w-full max-w-2xl rounded-2xl bg-black/[0.05] dark:bg-white/[0.07]" />
      <div className="mt-8 grid gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-24 rounded-[22px] bg-black/[0.05] dark:bg-white/[0.07]" />
        ))}
      </div>
    </div>
  );
}

/**
 * 宣传首页。
 * @returns 页面内容
 */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
