import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

/**
 * 全局 404 页面。
 * @returns 空态内容
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <BrandLogo size={56} className="opacity-90" />
        <p className="mt-6 text-xs font-medium tracking-[0.2em] text-brand">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">页面或应用不存在</h1>
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
          链接可能已失效，或该应用未公开。
        </p>
        <Link href="/" className="btn-primary mt-6">
          返回应用墙
        </Link>
      </div>
    </div>
  );
}
