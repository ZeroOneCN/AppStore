import Link from "next/link";

/**
 * 全局 404 页面。
 * @returns 空态内容
 */
export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">404</p>
        <h1 className="mt-2 text-xl font-semibold">页面或应用不存在</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          链接可能已失效，或该应用未公开。
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          返回应用墙
        </Link>
      </div>
    </div>
  );
}
