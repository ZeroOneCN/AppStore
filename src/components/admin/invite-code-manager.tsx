"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { InviteCodeItem, InviteCodeStatus } from "@/server/services/invite-code.service";

/** 状态展示配置 */
const STATUS_STYLE: Record<InviteCodeStatus, { label: string; className: string }> = {
  AVAILABLE: { label: "可用", className: "bg-emerald-50 text-emerald-700" },
  USED: { label: "已使用", className: "bg-black/[0.06] text-neutral-500" },
  EXPIRED: { label: "已过期", className: "bg-amber-50 text-amber-700" },
};

/**
 * 格式化时间。
 * @param value ISO 时间
 * @returns 本地日期文本
 */
function formatDate(value: string | null): string {
  if (!value) return "长期有效";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

/**
 * 邀请码管理：生成、复制、删除与状态查看。
 * @param props.items 邀请码列表
 * @param props.stats 数量概览
 * @returns 邀请码管理面板
 */
export function InviteCodeManager({
  items,
  stats,
}: {
  items: InviteCodeItem[];
  stats: { total: number; available: number };
}) {
  const router = useRouter();
  const [count, setCount] = useState("1");
  const [note, setNote] = useState("");
  const [days, setDays] = useState("0");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [created, setCreated] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * 批量生成邀请码。
   * @param event 表单提交事件
   * @returns 无
   */
  async function handleCreate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: Number(count),
          note: note.trim() || undefined,
          expiresInDays: Number(days),
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const text =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "生成失败")
            : "生成失败";
        setMessage({ type: "error", text });
        return;
      }
      const data = payload as { items?: InviteCodeItem[] } | null;
      setCreated((data?.items ?? []).map((item) => item.code));
      setMessage({ type: "ok", text: `已生成 ${data?.items?.length ?? 0} 个邀请码` });
      setNote("");
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络异常，请稍后重试" });
    } finally {
      setCreating(false);
    }
  }

  /**
   * 复制文本到剪贴板。
   * @param text 待复制内容
   * @returns 无
   */
  async function copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ type: "ok", text: `已复制 ${text}` });
    } catch {
      setMessage({ type: "error", text: "复制失败，请手动选择文本复制" });
    }
  }

  /**
   * 删除邀请码。
   * @param item 邀请码条目
   * @returns 无
   */
  async function handleDelete(item: InviteCodeItem): Promise<void> {
    if (!window.confirm(`确定删除邀请码 ${item.code}？`)) return;
    setDeletingId(item.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/invite-codes/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const text =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: { message?: string } }).error?.message ?? "删除失败")
            : "删除失败";
        setMessage({ type: "error", text });
        return;
      }
      setMessage({ type: "ok", text: `已删除 ${item.code}` });
      router.refresh();
    } catch {
      setMessage({ type: "error", text: "网络异常，请稍后重试" });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="surface w-full p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">邀请码</h2>
          <p className="mt-1 text-[11px] text-neutral-500">
            仅「邀请码注册」模式生效，每个邀请码仅可使用一次
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="chip">共 {stats.total}</span>
          <span className="chip">可用 {stats.available}</span>
        </div>
      </div>

      <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-[90px_1fr_110px_auto]">
        <div>
          <label htmlFor="inviteCount" className="mb-1.5 block text-[12px] font-medium">
            数量
          </label>
          <input
            id="inviteCount"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(event) => setCount(event.target.value)}
            className="input-apple"
            required
          />
        </div>
        <div>
          <label htmlFor="inviteNote" className="mb-1.5 block text-[12px] font-medium">
            备注
          </label>
          <input
            id="inviteNote"
            value={note}
            maxLength={60}
            onChange={(event) => setNote(event.target.value)}
            placeholder="例如：11 月批次"
            className="input-apple"
          />
        </div>
        <div>
          <label htmlFor="inviteDays" className="mb-1.5 block text-[12px] font-medium">
            有效期（天）
          </label>
          <input
            id="inviteDays"
            type="number"
            min={0}
            max={365}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            className="input-apple"
          />
          <p className="mt-1 text-[10px] text-neutral-400">0 表示长期有效</p>
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={creating} className="btn-primary min-h-10 w-full sm:w-auto">
            {creating ? "生成中…" : "生成邀请码"}
          </button>
        </div>
      </form>

      {message ? (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {created.length > 0 ? (
        <div className="mt-3 rounded-xl bg-brand/[0.06] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-medium text-brand">本次生成的邀请码</p>
            <button
              type="button"
              onClick={() => copy(created.join("\n"))}
              className="text-[12px] font-medium text-brand transition hover:text-brand-deep"
            >
              复制全部
            </button>
          </div>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {created.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => copy(code)}
                className="rounded-lg bg-white/80 px-2.5 py-1.5 text-left font-mono text-[12px] text-neutral-800 transition hover:bg-white"
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 divide-y divide-black/[0.06]">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-400">还没有邀请码，先生成一批吧</p>
        ) : (
          items.map((item) => {
            const status = STATUS_STYLE[item.status];
            return (
              <div key={item.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="font-mono text-[13px] font-medium tracking-wide">{item.code}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${status.className}`}>
                  {status.label}
                </span>
                {item.note ? (
                  <span className="text-[11px] text-neutral-500">{item.note}</span>
                ) : null}
                <span className="ml-auto text-[11px] text-neutral-400">
                  {item.status === "USED"
                    ? `${item.usedBy ?? "—"} · ${formatDate(item.usedAt)}`
                    : item.status === "AVAILABLE"
                      ? `有效期至 ${formatDate(item.expiresAt)}`
                      : `过期于 ${formatDate(item.expiresAt)}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copy(item.code)}
                    className="rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] text-neutral-600 transition hover:border-brand/30 hover:text-brand"
                  >
                    复制
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    disabled={deletingId === item.id}
                    className="rounded-lg border border-black/[0.08] bg-white/70 px-2.5 py-1 text-[11px] text-neutral-600 transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
                  >
                    {deletingId === item.id ? "删除中…" : "删除"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
