import { DocsEmbedded } from "@/app/(public)/docs/page";
import { PageHeader } from "@/components/page-header";

/**
 * 开发者后台接入文档：直接内嵌文档内容，不跳转外部页面。
 * @returns 文档页
 */
export default function DeveloperDocsPage() {
  return (
    <div className="w-full">
      <PageHeader
        title="接入文档"
        description="在应用内调用更新检查接口，支持 cURL、Java、Kotlin、Flutter、React Native、Node.js、Python、Go 与 C# 示例"
      />
      <DocsEmbedded />
    </div>
  );
}
