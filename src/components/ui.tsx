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
  status: "bg-fill text-ink-2",
  pick: "bg-ink text-card",
  ok: "bg-ok-bg text-ok",
  act: "bg-act-bg text-act",
};

export function Tag({ tone = "status", children, onClick }: { tone?: Tone; children: React.ReactNode; onClick?: () => void }) {
  const cls = `inline-flex items-center px-2 py-[3px] text-[12px] font-semibold leading-4 whitespace-nowrap ${toneCls[tone]}`;
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
    <section id={id} className="mt-20 scroll-mt-8 sm:mt-28">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 className="text-[26px] font-semibold tracking-[-0.025em] sm:text-[30px]">
          {label}
          {count !== undefined && <span className="num ml-2.5 text-muted">{count}</span>}
        </h2>
        {aside && <div className="text-[14px] text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

// A white panel on the grey page, like an inset grouped list.
export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card ${className}`}>{children}</div>;
}

// Departure over arrival, like a boarding pass.
export function Route({ from, to, depart, arrive }: { from?: string; to?: string; depart?: string; arrive?: string }) {
  if (!from && !depart) return null;
  return (
    <div className="flex gap-3 text-[14px]">
      <div className="flex flex-col items-center py-[7px]" aria-hidden>
        <span className="size-[7px] bg-ink" />
        <span className="my-1 w-[1.5px] flex-1 bg-rule" />
        <span className="size-[7px] border-[1.5px] border-ink" />
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

export function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[760px] px-5 pb-44 sm:px-10 ${className}`}>{children}</div>;
}

export function Nav({ here, date }: { here: "brief" | "night" | "trust"; date: string }) {
  const items = [
    { k: "brief", href: "/", label: "Brief" },
    { k: "night", href: "/night", label: "Night log" },
    { k: "trust", href: "/trust", label: "Trust" },
  ] as const;
  return (
    <nav className="flex h-12 items-center justify-between text-[13px]">
      <span className="font-semibold text-ink">{date}</span>
      <div className="flex gap-6 sm:gap-8">
        {items.map((i) =>
          i.k === here ? (
            <span key={i.k} className="font-semibold text-ink underline decoration-2 underline-offset-[6px]">{i.label}</span>
          ) : (
            <Link key={i.k} href={i.href} className="text-muted transition-colors hover:text-ink">{i.label}</Link>
          ),
        )}
      </div>
    </nav>
  );
}

// The vermilion band every page opens with.
export function DarkHeader({ here, date, children }: { here: "brief" | "night" | "trust"; date: string; children: React.ReactNode }) {
  return (
    <header className="hero">
      <div className="mx-auto w-full max-w-[760px] px-5 sm:px-10">
        <Nav here={here} date={date} />
        <div className="pb-14 pt-16 sm:pb-20 sm:pt-24">{children}</div>
      </div>
    </header>
  );
}

export function Btn({
  kind = "secondary",
  children,
  className = "",
  ...rest
}: { kind?: "primary" | "secondary" | "ghost" | "act" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const k = {
    primary: "bg-act text-white hover:brightness-110",
    act: "bg-act text-white hover:brightness-110",
    secondary: "bg-fill text-ink hover:brightness-95",
    ghost: "text-act hover:underline underline-offset-4 !px-0",
  }[kind];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ${k} ${className}`}
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
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="rise relative max-h-[88dvh] w-full max-w-[620px] overflow-y-auto bg-card px-6 pb-12 pt-5 shadow-[0_30px_80px_rgba(0,0,0,0.25)] sm:px-10">
        <div className="sticky top-0 -mx-6 mb-6 flex items-center justify-between bg-card px-6 pb-3 pt-1 sm:-mx-10 sm:px-10">
          <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h3>
          <button type="button" onClick={onClose} className="py-1 text-[15px] font-medium text-act">
            Done
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
