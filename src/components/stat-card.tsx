/**
 * 指标卡片：数值、名称与补充说明。
 * @param props.label 指标名称
 * @param props.value 指标数值
 * @param props.hint 补充说明
 * @param props.tone 可选强调色
 * @returns 统计卡片
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "brand";
}) {
  return (
    <div className="surface px-4 py-4">
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{label}</p>
      <p
        className={`mt-1 text-[26px] leading-none font-semibold tracking-tight tabular-nums ${
          tone === "brand" ? "text-brand" : ""
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11px] text-neutral-400">{hint}</p> : null}
    </div>
  );
}
