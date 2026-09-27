"use client";

import { useEffect } from "react";
import type { Flag } from "@/lib/derive";
import type { AuditStatus } from "@/lib/types";

type Tone = "act" | "ok" | "warn" | "bad" | "info" | "ink";

const toneCls: Record<Tone, string> = {
  act: "bg-act-bg text-act",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-transparent text-muted border border-rule",
  ink: "bg-ink text-paper",
};

export function Tag({ tone = "info", children, onClick }: { tone?: Tone; children: React.ReactNode; onClick?: () => void }) {
  const cls = `inline-flex items-center gap-1 px-1.5 py-[2px] text-[11px] font-medium leading-4 whitespace-nowrap ${toneCls[tone]}`;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} underline-offset-2 hover:underline`}>
        {children}
      </button>
    );
  return <span className={cls}>{children}</span>;
}

export function FlagTag({ f }: { f: Flag }) {
  return <Tag tone={f.level === "bad" ? "bad" : f.level === "warn" ? "warn" : "info"}>{f.text}</Tag>;
}

const auditMeta: Record<AuditStatus, { tone: Tone; label: string }> = {
  verified: { tone: "ok", label: "Verified" },
  conflict: { tone: "bad", label: "Conflict" },
  unsourced: { tone: "bad", label: "Unsourced" },
  stale: { tone: "warn", label: "Stale" },
  unverifiable: { tone: "info", label: "Can't verify" },
};

export function AuditTag({ status, onClick }: { status: AuditStatus; onClick?: () => void }) {
  const m = auditMeta[status];
  return (
    <Tag tone={m.tone} onClick={onClick}>
      {m.label}
    </Tag>
  );
}

export function Section({
  label,
  count,
  aside,
  children,
  id,
}: {
  label: string;
  count?: number;
  aside?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-4">
      <div className="flex items-baseline justify-between border-t border-rule-strong pt-2 pb-3">
        <h2 className="eyebrow !text-ink">
          {label}
          {count !== undefined && <span className="num ml-1.5 text-muted">{count}</span>}
        </h2>
        {aside && <div className="text-[12px] text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Btn({
  kind = "secondary",
  children,
  className = "",
  ...rest
}: { kind?: "primary" | "secondary" | "ghost" | "act" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const k = {
    primary: "bg-ink text-paper hover:opacity-90",
    act: "bg-act text-paper hover:opacity-90",
    secondary: "border border-ink text-ink hover:bg-ink hover:text-paper",
    ghost: "text-ink-2 underline underline-offset-4 decoration-rule hover:decoration-ink px-0",
  }[kind];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-[14px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${k} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <div className="relative max-h-[85dvh] w-full max-w-[480px] overflow-y-auto border-t border-rule-strong bg-paper px-4 pb-8 pt-3 sm:border">
        <div className="sticky top-0 -mx-4 mb-3 flex items-center justify-between border-b border-rule bg-paper px-4 pb-2">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="px-2 py-1 text-[13px] text-muted hover:text-ink">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Glyph({ kind }: { kind: string }) {
  const map: Record<string, { c: string; t: string }> = {
    decision: { c: "text-act", t: "◆" },
    would_book: { c: "text-ok", t: "●" },
    assumption: { c: "text-warn", t: "◇" },
    mistake: { c: "text-bad", t: "✕" },
    update: { c: "text-muted", t: "○" },
    search: { c: "text-muted", t: "·" },
  };
  const m = map[kind] ?? map.update;
  return (
    <span aria-hidden className={`inline-block w-3 text-center ${m.c}`}>
      {m.t}
    </span>
  );
}
