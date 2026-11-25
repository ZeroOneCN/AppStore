/**
 * 前台首页占位。
 * 应用墙、搜索与筛选将在 B4 批次实现，这里仅保证站点可启动并返回 200。
 * @returns 首页内容
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-3 px-6">
      <h1 className="text-3xl font-semibold tracking-tight">我的应用仓库</h1>
      <p className="text-neutral-500">
        个人应用与网页作品的分发展示中心。前台页面将在后续批次上线。
      </p>
    </main>
  );
}
