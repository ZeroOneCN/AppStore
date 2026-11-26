/**
 * 页面标题区：标题、说明与右侧操作。
 * @param props.title 页面标题
 * @param props.description 补充说明
 * @param props.eyebrow 标题上方的短标签
 * @param props.actions 右侧操作区域
 * @returns 标题区结构
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-header mb-6">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 text-[11px] font-medium tracking-[0.18em] text-brand uppercase">{eyebrow}</p>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-desc">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 [&>*]:min-w-[104px] [&>*]:justify-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
