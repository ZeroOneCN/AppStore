import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderSkeleton } from "@/components/site-header";

/**
 * 前台公共布局：毛玻璃导航、页面内容与多栏页脚。
 * @param props.children 页面内容
 * @returns 布局结构
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col text-neutral-900">
      <Suspense fallback={<SiteHeaderSkeleton />}>
        <SiteHeader />
      </Suspense>

      <main className="flex flex-1 flex-col">{children}</main>

      <Suspense fallback={<div className="mt-16 h-48 border-t border-black/[0.06]" />}>
        <SiteFooter />
      </Suspense>
    </div>
  );
}
