"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ampm } from "@/lib/format";
import type { Flag } from "@/lib/derive";
import type { AuditStatus } from "@/lib/types";

type Tone = "problem" | "tradeoff" | "status" | "pick" | "ok" | "act";

const toneCls: Record<Tone, string> = {
  problem: "bg-bad-bg text-bad",
  tradeoff: "bg-warn-bg text-warn",
  status: "border border-rule text-ink-2",
  pick: "bg-ink text-paper",
  ok: "bg-ok-bg text-ok",
  act: "bg-act-bg text-act",
};

export function Tag({ tone = "status", children, onClick }: { tone?: Tone; children: React.ReactNode; onClick?: () => void }) {
  const cls = `inline-flex items-center px-2 py-[3px] text-[12px] font-medium leading-4 whitespace-nowrap ${toneCls[tone]}`;
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={`${cls} underline-offset-2 hover:underline`}>
        {children}
      </button>
    );
  return <span className={cls}>{children}</span>;
}

export function FlagTag({ f, onClick }: { f: Flag; onClick?: () => void }) {
  return (
    <Tag tone={f.kind} onClick={onClick}>
      {f.text}
    </Tag>
  );
}

const auditMeta: Record<AuditStatus, { tone: Tone; label: string }> = {
  verified: { tone: "status", label: "Verified" },
  conflict: { tone: "problem", label: "Conflict" },
  unsourced: { tone: "problem", label: "Unverified" },
  stale: { tone: "tradeoff", label: "Stale" },
  unverifiable: { tone: "status", label: "Can't verify" },
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
    <section id={id} className="mt-16 scroll-mt-6 sm:mt-24">
      <div className="mb-5 flex items-baseline justify-between border-t border-rule-strong pt-3">
        <h2 className="eyebrow !text-ink">
          {label}
          {count !== undefined && <span className="num ml-2 text-muted">{count}</span>}
        </h2>
        {aside && <div className="text-[13px] text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

// Departure over arrival, like a boarding pass.
export function Route({ from, to, depart, arrive }: { from?: string; to?: string; depart?: string; arrive?: string }) {
  if (!from && !depart) return null;
  return (
    <div className="flex gap-3 text-[14px]">
      <div className="flex flex-col items-center py-[7px]" aria-hidden>
        <span className="size-[7px] bg-ink" />
        <span className="my-1 w-px flex-1 bg-rule" />
        <span className="size-[7px] border border-ink" />
      </div>
      <div className="space-y-1.5">
        <div>
          {depart && <span className="num mr-2 font-medium">{ampm(depart)}</span>}
          <span className="text-ink-2">{from}</span>
        </div>
        <div>
          {arrive && <span className="num mr-2 font-medium">{ampm(arrive)}</span>}
          <span className="text-ink-2">{to}</span>
        </div>
      </div>
    </div>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[720px] px-5 pb-44 pt-8 sm:px-10 sm:pt-14">{children}</div>;
}

export function Nav({ here, date }: { here: "brief" | "night" | "trust"; date: string }) {
  const items = [
    { k: "brief", href: "/", label: "Brief" },
    { k: "night", href: "/night", label: "Night log" },
    { k: "trust", href: "/trust", label: "Trust" },
  ] as const;
  return (
    <nav className="flex items-center justify-between text-[14px]">
      <span className="eyebrow">{date}</span>
      <div className="flex gap-5 sm:gap-7">
        {items.map((i) =>
          i.k === here ? (
            <span key={i.k} className="text-ink">{i.label}</span>
          ) : (
            <Link key={i.k} href={i.href} className="text-muted hover:text-ink">{i.label}</Link>
          ),
        )}
      </div>
    </nav>
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
      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-[14.5px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${k} ${className}`}
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
      <div className="relative max-h-[85dvh] w-full max-w-[600px] overflow-y-auto border-t border-rule-strong bg-paper px-5 pb-10 pt-4 sm:border sm:px-8">
        <div className="sticky top-0 -mx-5 mb-5 flex items-center justify-between border-b border-rule bg-paper px-5 pb-3 sm:-mx-8 sm:px-8">
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
