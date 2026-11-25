/**
 * 表单字段的悬浮说明图标。
 * @param props.text 说明文案
 * @returns 问号图标与悬浮提示
 */
export function HelpTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        role="img"
        aria-label={text}
        className="grid h-4 w-4 cursor-help place-items-center rounded-full border border-neutral-300 text-[10px] leading-none text-neutral-500 outline-none focus:ring-2 focus:ring-indigo-200 dark:border-neutral-600 dark:text-neutral-400 dark:focus:ring-indigo-500/30"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-1.5 hidden w-60 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-normal leading-5 text-white shadow-lg group-hover:block group-focus-within:block dark:bg-neutral-700"
      >
        {text}
      </span>
    </span>
  );
}
