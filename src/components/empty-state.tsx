/**
 * 空态容器：居中标题、说明与可选操作。
 * @param props.title 主文案
 * @param props.description 补充说明
 * @param props.action 操作区域（按钮或链接）
 * @param props.compact 是否使用较矮的高度
 * @returns 空态结构
 */
export function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`empty-state ${compact ? "min-h-[220px]" : ""}`}>
      <p className="text-base font-medium">{title}</p>
      {description ? (
        <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500 dark:text-neutral-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
