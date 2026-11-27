import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AppCard, AppIcon } from "@/components/app-card";
import { PageViewTracker } from "@/components/analytics/page-view-tracker";
import { StatCard } from "@/components/stat-card";
import { getRequestOrigin } from "@/server/http/base-url";
import { listPublicApps, type AppCardDto } from "@/server/services/app.service";
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

/** 首屏接入概览：不展示代码，只保留最关键的三个动作 */
const ACCESS_STEPS = [
  { title: "发起检查", description: "调用一次更新检查接口" },
  { title: "拿到结果", description: "版本对比与强制更新标记" },
  { title: "下载校验", description: "签名地址 + SHA-256 校验" },
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

/** 首页展示的联系邮箱 */
const CONTACT_EMAIL = "service@01iot.top";

/**
 * 精选大卡：首页前两位主推应用，展示更完整的简介与更新时间。
 * @param props.app 应用卡片数据
 * @returns 大尺寸卡片链接
 */
function FeaturedAppCard({ app }: { app: AppCardDto }) {
  const author = app.developer ? app.developer.displayName || app.developer.username : "平台官方";
  const updated = new Date(app.updatedAt);
  const updatedLabel = `${updated.getMonth() + 1} 月 ${updated.getDate()} 日更新`;

  return (
    <Link
      href={`/apps/${app.slug}`}
      className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-black/[0.06] bg-white/85 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_22px_48px_-30px_rgba(30,81,238,0.65)] sm:p-6 dark:border-white/10 dark:bg-[#1c1c1e]/85 dark:hover:border-brand/40"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-brand/10 blur-3xl transition duration-300 group-hover:bg-brand/20"
      />
      <div className="relative flex items-start gap-4">
        <AppIcon name={app.name} iconUrl={app.iconUrl} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[18px] font-semibold tracking-tight">{app.name}</h3>
            {app.pinned ? (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                置顶
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[12px] text-neutral-500 dark:text-neutral-400">
            {author} · {updatedLabel}
          </p>
          <p className="mt-2 line-clamp-2 min-h-[48px] text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
            {app.summary}
          </p>
        </div>
      </div>

      <div className="relative mt-4 flex flex-wrap gap-1.5">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            app.type === "ANDROID"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
          }`}
        >
          {app.type === "ANDROID" ? "Android" : "网页"}
        </span>
        <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] text-neutral-600 dark:bg-white/[0.08] dark:text-neutral-300">
          {app.category}
        </span>
        {app.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-black/[0.06] px-2 py-0.5 text-[11px] text-neutral-500 dark:border-white/10 dark:text-neutral-400"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-black/[0.05] pt-3 text-[11px] text-neutral-500 dark:border-white/[0.08] dark:text-neutral-400">
        <span className="truncate tabular-nums">
          {app.currentVersion
            ? `v${app.currentVersion.versionName}`
            : app.type === "WEB"
              ? "网页作品"
              : "尚未发布"}
        </span>
        <span className="shrink-0 tabular-nums">{app.downloadCount} 次下载</span>
      </div>
    </Link>
  );
}

/**
 * 首页数据区：读取公开应用并渲染宣传内容。
 * @returns 首页主体
 */
async function HomeContent() {
  await connection();
  const apps = await listPublicApps({ sort: "recent" });

  const featured = apps.slice(0, 6);
  const featuredPrimary = featured.slice(0, 2);
  const featuredRest = featured.slice(2);
  const androidCount = apps.filter((app) => app.type === "ANDROID").length;
  const webCount = apps.length - androidCount;
  const downloads = apps.reduce((sum, app) => sum + app.downloadCount, 0);
  const { siteName } = await getSiteSettings();
  const origin = await getRequestOrigin();
  const checkEndpoint = `${origin}/api/update/check`;
  // 商店自身客户端：优先按包名匹配，兜底按访问标识匹配，用于首屏下载入口与在线调试示例
  const clientApp =
    apps.find((app) => app.packageName === "com.appstore.appstore_client") ??
    apps.find((app) => app.slug === "appstore-client") ??
    null;
  const tryApp = clientApp ?? apps.find((app) => app.packageName) ?? null;
  const tryUrl = tryApp?.packageName
    ? `${checkEndpoint}?packageName=${encodeURIComponent(tryApp.packageName)}&versionCode=1`
    : null;

  return (
    <div className="flex flex-1 flex-col">
      <PageViewTracker path="/" />
      {/* Hero：大标题、行动按钮与右侧接入概览 */}
      <section className="page-shell relative overflow-hidden pt-10 pb-8 sm:pt-16 sm:pb-12">
        <div className="hero-glow -top-24 left-1/2 h-72 w-[520px] -translate-x-1/2" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.045) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 62% 58% at 50% 38%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 62% 58% at 50% 38%, black, transparent)",
          }}
        />

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
              {clientApp ? (
                <>
                  <Link href={`/apps/${clientApp.slug}`} className="btn-primary py-3 text-[14px]">
                    下载 Android 客户端
                  </Link>
                  <Link href="/apps" className="btn-secondary py-3 text-[14px]">
                    浏览全部应用
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/apps" className="btn-primary py-3 text-[14px]">
                    浏览应用
                  </Link>
                  <Link href="/docs" className="btn-secondary py-3 text-[14px]">
                    查看接入文档
                  </Link>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              {clientApp?.currentVersion ? (
                <span className="tabular-nums">
                  客户端 v{clientApp.currentVersion.versionName}（{clientApp.currentVersion.versionCode}）
                </span>
              ) : null}
              {clientApp ? (
                <Link href="/docs" className="font-medium text-brand transition hover:text-brand-deep">
                  查看接入文档 →
                </Link>
              ) : null}
            </div>

            <dl className="mt-8 grid max-w-xl grid-cols-4 gap-1.5 sm:gap-2">
              <div className="min-w-0">
                <StatCard label="应用" value={apps.length} tone="brand" />
              </div>
              <div className="min-w-0">
                <StatCard label="累计下载" value={downloads} />
              </div>
              <div className="min-w-0">
                <StatCard label="Android" value={androidCount} />
              </div>
              <div className="min-w-0">
                <StatCard label="网页作品" value={webCount} />
              </div>
            </dl>
          </div>

          <div className="relative min-w-0">
            <div className="surface p-5 sm:p-6" style={{ boxShadow: "var(--shadow-float)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13px] font-semibold">接入很轻，一次请求就够</p>
                <span className="chip">无需 SDK</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                客户端启动时调用一次，直接拿到版本、更新日志与签名下载地址。
              </p>

              <ol className="mt-4 space-y-2">
                {ACCESS_STEPS.map((item, index) => (
                  <li
                    key={item.title}
                    className="flex items-center gap-3 rounded-xl bg-black/[0.025] px-3 py-2.5 dark:bg-white/[0.04]"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-semibold text-brand tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium">{item.title}</p>
                      <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                        {item.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="chip">断点续传</span>
                <span className="chip">SHA-256 校验</span>
                <span className="chip">强制更新</span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/[0.05] pt-3 text-[11px] text-neutral-500 dark:border-white/[0.08] dark:text-neutral-400">
                <span className="hidden sm:inline">下载链接 10 分钟有效</span>
                <div className="flex items-center gap-3">
                  {tryUrl ? (
                    <a
                      href={tryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand transition hover:text-brand-deep"
                    >
                      在线试试 →
                    </a>
                  ) : null}
                  <Link href="/docs" className="shrink-0 font-medium text-brand transition hover:text-brand-deep">
                    完整文档 →
                  </Link>
                </div>
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
          <>
            <div
              className={`mt-5 grid gap-4 ${featuredPrimary.length > 1 ? "md:grid-cols-2" : ""}`}
            >
              {featuredPrimary.map((app) => (
                <FeaturedAppCard key={app.id} app={app} />
              ))}
            </div>
            {featuredRest.length > 0 ? (
              <div className="mt-4 grid auto-rows-fr gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
                {featuredRest.map((app) => (
                  <AppCard key={app.id} app={app} />
                ))}
              </div>
            ) : null}
          </>
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

      {/* 联系我们 */}
      <section className="page-shell mt-16">
        <div className="surface grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-brand">
              <svg
                viewBox="0 0 24 24"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2.5" />
                <path d="m4 7 8 5 8-5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-[0.18em] text-brand uppercase">联系我们</p>
              <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.01em] sm:text-[22px]">
                有问题、建议或合作？
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-neutral-500 dark:text-neutral-400">
                应用收录、账号申请、接入问题或功能建议，都可以直接发邮件，我们会尽快回复。
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <a href={`mailto:${CONTACT_EMAIL}`} className="btn-primary w-full py-3 text-[14px] sm:w-auto">
              发邮件给我们
            </a>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-center font-mono text-[12px] text-neutral-500 transition hover:text-brand sm:text-left dark:text-neutral-400"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
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
            <p className="mx-auto mt-2 text-[12px] text-neutral-400">
              自托管部署 · 应用与数据都存放在自己的服务器
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
