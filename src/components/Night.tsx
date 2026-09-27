"use client";

import Link from "next/link";
import { useState } from "react";
import type { Brief } from "@/lib/derive";
import { clock, day, money, toCad } from "@/lib/format";
import type { Kind } from "@/lib/types";
import { AuditSheet } from "./AuditSheet";
import { AuditTag, Glyph } from "./ui";

const FILTERS: { k: Kind | "all"; label: string }[] = [
  { k: "all", label: "All" },
  { k: "decision", label: "Decisions" },
  { k: "would_book", label: "Reserved" },
  { k: "mistake", label: "Mistakes" },
  { k: "assumption", label: "Assumptions" },
  { k: "update", label: "Updates" },
];

const KIND_LABEL: Record<Kind, string> = {
  decision: "Decision for you",
  would_book: "Reserved",
  assumption: "Assumption",
  mistake: "Mistake",
  update: "Update",
  search: "Search",
};

const DOT: Record<Kind, string> = {
  decision: "bg-act",
  would_book: "bg-ok",
  assumption: "bg-warn",
  mistake: "bg-bad",
  update: "bg-muted",
  search: "bg-rule",
};

export function Night({ brief }: { brief: Brief }) {
  const [f, setF] = useState<Kind | "all">("all");
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const { run, timeline, audit } = brief;
  const t0 = new Date(run.started_at).getTime();
  const t1 = new Date(run.wake_at).getTime();
  const shown = timeline.filter((e) => f === "all" || e.kind === f);

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-24 pt-6">
      <nav className="flex items-center justify-between text-[13px]">
        <span className="eyebrow">{day(run.wake_at)}</span>
        <div className="flex gap-4 text-muted">
          <Link href="/" className="hover:text-ink">Brief</Link>
          <span className="text-ink">Night log</span>
          <Link href="/trust" className="hover:text-ink">Trust</Link>
        </div>
      </nav>

      <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.02em]">Last night, entry by entry</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
        Everything {run.agent} logged between {clock(run.started_at)} and {clock(run.ended_at)}, unedited. The brief is built from this. If something there looks wrong, this is where to find out why.
      </p>

      {/* The night at a glance: one tick per entry on a midnight-to-wake axis. */}
      <div className="mt-6" aria-hidden>
        <div className="relative h-8 border-b border-rule-strong">
          {timeline.map((e) => {
            const x = ((new Date(e.ts).getTime() - t0) / (t1 - t0)) * 100;
            const tall = e.kind === "decision" || e.kind === "mistake" || e.kind === "would_book";
            return <span key={e.id} className={`absolute bottom-0 w-[3px] ${DOT[e.kind]} ${tall ? "h-7" : "h-3.5"}`} style={{ left: `${x}%` }} title={e.title} />;
          })}
        </div>
        <div className="num mt-1 flex justify-between text-[10.5px] text-muted">
          {["12 AM", "2", "4", "6", "8 AM"].map((h) => (
            <span key={h}>{h}</span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {(["decision", "would_book", "mistake", "assumption", "update"] as Kind[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`inline-block size-2 ${DOT[k]}`} /> {KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1" role="tablist">
        {FILTERS.map((x) => {
          const n = x.k === "all" ? timeline.length : timeline.filter((e) => e.kind === x.k).length;
          return (
            <button
              key={x.k}
              type="button"
              role="tab"
              aria-selected={f === x.k}
              onClick={() => setF(x.k)}
              className={`shrink-0 border px-2.5 py-1 text-[12.5px] ${f === x.k ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink"}`}
            >
              {x.label} <span className="num opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      <ol className="mt-4 border-l border-rule">
        {shown.map((e) => {
          const claims = audit.claims.filter((c) => c.event_id === e.id);
          const worst = claims.find((c) => c.status !== "verified") ?? claims[0];
          return (
            <li key={e.id} className="relative pb-5 pl-5">
              <span className={`absolute -left-[4.5px] top-[7px] size-2 ${DOT[e.kind]}`} aria-hidden />
              <div className="flex items-center gap-2 text-[11.5px] text-muted">
                <span className="num">{clock(e.ts)}</span>
                <span>·</span>
                <span>
                  <Glyph kind={e.kind} /> {KIND_LABEL[e.kind]}
                </span>
                {worst && <AuditTag status={worst.status} onClick={() => setAuditFor(e.id)} />}
              </div>
              <div className="mt-0.5 text-[14.5px] font-medium leading-snug">{e.title}</div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{e.detail}</p>
              {e.options && e.options.length > 0 && (
                <ul className="mt-1.5 border-t border-rule">
                  {e.options.map((o) => (
                    <li key={o.label} className="flex justify-between gap-3 border-b border-rule py-1 text-[12.5px]">
                      <span className="min-w-0 text-ink-2">
                        {o.label}
                        {o.source_url ? (
                          <a href={o.source_url} target="_blank" rel="noreferrer" className="ml-1.5 text-muted underline underline-offset-2">
                            source
                          </a>
                        ) : (
                          <span className="ml-1.5 text-bad">no source</span>
                        )}
                      </span>
                      <span className="num shrink-0">
                        {o.currency !== "CAD" && <span className="text-muted">{o.currency} {o.price} · </span>}
                        {money(toCad(o.price, o.currency))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      <AuditSheet brief={brief} eventId={auditFor} onClose={() => setAuditFor(null)} />
    </div>
  );
}
