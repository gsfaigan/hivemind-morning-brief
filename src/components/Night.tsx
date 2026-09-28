"use client";

import { useMemo, useState } from "react";
import { derive } from "@/lib/derive";
import type { RawData } from "@/lib/types";
import { clock, day, money, toCad } from "@/lib/format";
import type { Kind } from "@/lib/types";
import { AuditSheet } from "./AuditSheet";
import { TICK } from "./Brief";
import { AuditTag, DarkHeader, Glyph, Page } from "./ui";

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

export function Night({ data }: { data: RawData }) {
  const brief = useMemo(() => derive(data.run, data.log, data.audit), [data]);
  const [f, setF] = useState<Kind | "all">("all");
  const [who, setWho] = useState<string>("all");
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const { run, timeline, audit } = brief;
  const t0 = new Date(run.started_at).getTime();
  const t1 = new Date(run.wake_at).getTime();
  const multi = run.agents.length > 1;
  const pool = timeline.filter((e) => who === "all" || e.agent === who);
  const shown = pool.filter((e) => f === "all" || e.kind === f);
  const seg = (on: boolean) =>
    `shrink-0 px-3.5 py-1.5 text-[14px] transition-colors ${on ? "bg-card font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-2 hover:text-ink"}`;

  return (
    <>
      <DarkHeader here="night" date={day(run.wake_at)}>
        <h1 className="rise text-[44px] font-semibold leading-[1] tracking-[-0.04em] sm:text-[72px]">Last night.</h1>
        <p className="rise mt-5 text-[20px] leading-snug text-ink-2 [animation-delay:80ms] sm:text-[24px]">Everything {run.agents.map((a) => a.name).join(" and ")} logged, unedited.</p>

        {/* One tick per entry, midnight to wake-up. */}
        <div className="mt-14 sm:mt-20" aria-hidden>
          <div className="space-y-5">
            {run.agents.map((a) => (
              <div key={a.id}>
                {multi && <div className="mb-1.5 text-[13px] font-semibold">{a.name}</div>}
                <div className="relative h-12">
                  {timeline
                    .filter((e) => e.agent === a.id)
                    .map((e) => {
                      const x = ((new Date(e.ts).getTime() - t0) / (t1 - t0)) * 100;
                      return <span key={e.id} className={`absolute bottom-0 w-[3px] ${TICK[e.kind]}`} style={{ left: `${x}%` }} />;
                    })}
                </div>
                <div className="h-px bg-rule" />
              </div>
            ))}
          </div>
          <div className="num mt-2 flex justify-between text-[12px] text-muted">
            <span>{clock(run.started_at)}</span>
            <span>{clock(run.wake_at)}</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted">
            {(["decision", "would_book", "mistake", "assumption", "update"] as Kind[]).map((k) => (
              <span key={k} className="flex items-center gap-2">
                <span className={`inline-block w-[3px] ${TICK[k].replace(/h-\d+/, "h-3.5")}`} /> {KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
      </DarkHeader>

      <Page className="pt-10 sm:pt-14">
      {multi && (
        <div className="mb-3 inline-flex max-w-full gap-0.5 overflow-x-auto bg-fill p-0.5" role="tablist" aria-label="Agent">
          {[{ id: "all", name: "Both agents" }, ...run.agents].map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={who === a.id} onClick={() => setWho(a.id)} className={seg(who === a.id)}>
              {a.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex max-w-full gap-0.5 overflow-x-auto bg-fill p-0.5 sm:w-fit" role="tablist" aria-label="Kind">
        {FILTERS.map((x) => {
          const n = x.k === "all" ? pool.length : pool.filter((e) => e.kind === x.k).length;
          return (
            <button
              key={x.k}
              type="button"
              role="tab"
              aria-selected={f === x.k}
              onClick={() => setF(x.k)}
              className={seg(f === x.k)}
            >
              {x.label} <span className="num opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      <ol className="mt-10 border-l border-rule">
        {shown.map((e) => {
          const claims = audit.claims.filter((c) => c.event_id === e.id);
          const worst = claims.find((c) => c.status !== "verified") ?? claims[0];
          return (
            <li key={e.id} className="relative pb-9 pl-6 sm:pl-8">
              <span className={`absolute -left-[4.5px] top-[6px] size-2 ${DOT[e.kind]}`} aria-hidden />
              <div className="flex items-center gap-2 text-[12.5px] text-muted">
                {multi && <span className="font-semibold text-ink">{brief.agentName(e.agent)}</span>}
                <span className="num">{clock(e.ts)}</span>
                <span>·</span>
                <span>
                  <Glyph kind={e.kind} /> {KIND_LABEL[e.kind]}
                </span>
                {worst && <AuditTag status={worst.status} onClick={() => setAuditFor(e.id)} />}
              </div>
              <div className="mt-1.5 text-[16.5px] font-medium leading-snug">{e.headline ?? e.title}</div>
              <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">{e.detail}</p>
              {e.options && e.options.length > 0 && (
                <ul className="mt-3 border-t border-rule">
                  {e.options.map((o) => (
                    <li key={o.label} className="flex justify-between gap-4 border-b border-rule py-2 text-[13.5px]">
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
      </Page>
      <AuditSheet brief={brief} eventId={auditFor} onClose={() => setAuditFor(null)} />
    </>
  );
}
