"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActionView, Brief as BriefT } from "@/lib/derive";
import { clock, day, money, until } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStore } from "@/lib/store";
import type { LogEvent } from "@/lib/types";
import { DecisionCard } from "./DecisionCard";
import { AuditSheet } from "./AuditSheet";
import { Outbox } from "./Outbox";
import { AuditTag, Btn, FlagTag, Section, Tag } from "./ui";

const LEGS: { thread: string; label: string; when: string }[] = [
  { thread: "out", label: "Toronto → New York", when: "Sat Oct 10" },
  { thread: "nyc-stay", label: "New York bed", when: "4 nights" },
  { thread: "nyc-bos", label: "New York → Boston", when: "Wed Oct 14" },
  { thread: "bos-stay", label: "Boston bed", when: "4 nights" },
  { thread: "return", label: "Boston → Toronto", when: "Sun Oct 18" },
];

export function Brief({ brief }: { brief: BriefT }) {
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const { s } = useStore();
  const live = useLive(brief);
  const { run } = brief;
  const hours = (new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 3600e3;
  const verified = brief.audit.claims.filter((c) => c.status === "verified").length;
  const problems = brief.audit.claims.filter((c) => c.status === "conflict" || c.status === "unsourced").length;
  const openCount = live.open.length;
  const searches = brief.timeline.find((e) => /searches/.test(e.detail))?.detail.match(/(\d+) searches/)?.[1];

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-40 pt-6">
      {run.sample && (
        <div className="mb-5 border border-warn bg-warn-bg px-3 py-2 text-[12.5px] text-warn">
          Sample data. The real overnight Muse log replaces this.
        </div>
      )}

      <nav className="flex items-center justify-between text-[13px]">
        <span className="eyebrow">{day(run.wake_at)}</span>
        <div className="flex gap-4 text-muted">
          <span className="text-ink">Brief</span>
          <Link href="/night" className="hover:text-ink">Night log</Link>
          <Link href="/trust" className="hover:text-ink">Trust</Link>
        </div>
      </nav>

      <header className="mt-6">
        <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.025em]">Good morning, Gabe.</h1>
        <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2">
          Muse worked on your reading-week trip for {hours.toFixed(0)} hours while you slept. It reserved{" "}
          {brief.actions.length} things, all free to cancel, and{" "}
          {openCount ? (
            <a href="#needs-you" className="font-medium text-act underline underline-offset-4">
              needs you for {openCount}
            </a>
          ) : (
            <span className="font-medium text-ok">has nothing left for you to decide</span>
          )}
          .
        </p>
        <dl className="mt-4 grid grid-cols-3 border-y border-rule text-[12px]">
          <div className="py-2">
            <dt className="text-muted">Worked</dt>
            <dd className="num mt-0.5 text-[14px] font-medium">
              {clock(run.started_at).replace(/\s?[AP]M/, "")}–{clock(run.ended_at)}
            </dd>
          </div>
          <div className="border-l border-rule py-2 pl-3">
            <dt className="text-muted">Searches</dt>
            <dd className="num mt-0.5 text-[14px] font-medium">{searches ?? brief.searches.length}</dd>
          </div>
          <div className="border-l border-rule py-2 pl-3">
            <dt className="text-muted">Fact-check</dt>
            <dd className="mt-0.5 text-[14px] font-medium">
              <button type="button" onClick={() => setAuditFor("all")} className="num underline decoration-rule underline-offset-4 hover:decoration-ink">
                {verified}/{brief.audit.claims.length} hold up
              </button>
            </dd>
          </div>
        </dl>
      </header>

      <SpendMeter brief={brief} />

      <TripStrip brief={brief} />

      {openCount > 0 && (
        <Section id="needs-you" label="Needs you" count={openCount} aside={`about ${openCount * 45}s`}>
          <div className="space-y-4">
            {brief.decisions
              .filter((d) => (s.decisions[d.event.id]?.status ?? "open") === "open")
              .map((d) => (
                <DecisionCard key={d.event.id} d={d} brief={brief} onAudit={setAuditFor} />
              ))}
          </div>
        </Section>
      )}

      {live.decided.length > 0 && (
        <Section label="You decided" count={live.decided.length}>
          <div className="space-y-2">
            {live.decided.map((d) => (
              <DecisionCard key={d.event.id} d={d} brief={brief} onAudit={setAuditFor} />
            ))}
          </div>
        </Section>
      )}

      {brief.checkFirst.length > 0 && (
        <Section label="Worth a second look" count={brief.checkFirst.length} aside={problems ? `${problems} flagged by the fact-check` : undefined}>
          <ul className="border-t border-rule">
            {brief.checkFirst.map((c, i) => (
              <li key={i} className="flex gap-2.5 border-b border-rule py-2.5 text-[14px] leading-snug">
                <span aria-hidden className={`mt-[3px] inline-block size-2 shrink-0 ${c.level === "bad" ? "bg-bad" : c.level === "warn" ? "bg-warn" : "bg-rule"}`} />
                <button type="button" className="text-left hover:underline" onClick={() => setAuditFor(c.event_id)}>
                  {c.text}
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Done without you" count={brief.actions.length} aside="all reversible">
        <div className="space-y-3">
          {brief.actions.map((a) => (
            <ActionRow key={a.event.id} a={a} brief={brief} onAudit={setAuditFor} />
          ))}
        </div>
      </Section>

      <Section label="Assumptions Muse made" count={brief.assumptions.length} aside="flip any of them">
        <div className="border-t border-rule">
          {brief.assumptions.map((e) => (
            <AssumptionRow key={e.id} e={e} />
          ))}
        </div>
      </Section>

      <Section label="For your information" count={brief.updates.length}>
        <ul className="border-t border-rule">
          {brief.updates.map((e) => (
            <li key={e.id} className="border-b border-rule py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-medium leading-snug">{e.title}</span>
                <span className="num shrink-0 text-[12px] text-muted">{clock(e.ts)}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{e.detail}</p>
            </li>
          ))}
        </ul>
        <Link href="/night" className="mt-3 inline-block text-[13px] text-muted underline underline-offset-4 hover:text-ink">
          All {brief.timeline.length} entries from last night →
        </Link>
      </Section>

      <AuditSheet brief={brief} eventId={auditFor} onClose={() => setAuditFor(null)} />
      <Outbox brief={brief} />
    </div>
  );
}

function SpendMeter({ brief }: { brief: BriefT }) {
  const l = useLive(brief);
  const max = Math.max(l.budget, l.projected) * 1.04;
  const pct = (n: number) => `${(n / max) * 100}%`;
  const left = l.budget - l.projected;
  return (
    <section className="mt-8" aria-label="Budget">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Budget</span>
        <span className={`num text-[13px] ${left < 0 ? "text-bad" : "text-ink-2"}`}>
          {left >= 0 ? `${money(left)} left if you take Muse's picks` : `${money(-left)} over`}
        </span>
      </div>
      <div className="num mt-1 text-[28px] font-semibold tracking-[-0.02em]">
        {money(l.projected)} <span className="text-[16px] font-normal text-muted">of {money(l.budget)}</span>
      </div>
      <div className="relative mt-3 h-3 border border-rule-strong">
        <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: pct(l.reserved) }} />
        <div className="absolute inset-y-0 bg-ink-2" style={{ left: pct(l.reserved), width: pct(l.chosen) }} />
        <div className="absolute inset-y-0 bg-rule" style={{ left: pct(l.reserved + l.chosen), width: pct(l.pending) }} />
        <div className="absolute -inset-y-1.5 w-px bg-act" style={{ left: pct(l.preauth) }} title="Overnight limit" />
        <div className="absolute -inset-y-1.5 w-0.5 bg-ink" style={{ left: pct(l.budget) }} />
      </div>
      <div className="relative mt-1 h-4 text-[10.5px] text-muted">
        <span className="absolute -translate-x-1/2 text-act" style={{ left: pct(l.preauth) }}>
          {money(l.preauth)} overnight limit
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
        <Legend sw="bg-ink" k="Reserved" v={l.reserved} />
        <Legend sw="bg-ink-2" k="Your picks" v={l.chosen} />
        <Legend sw="bg-rule" k="Waiting on you" v={l.pending} />
      </dl>
    </section>
  );
}

function Legend({ sw, k, v }: { sw: string; k: string; v: number }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-muted">
        <span aria-hidden className={`inline-block size-2.5 ${sw}`} />
        {k}
      </dt>
      <dd className="num mt-0.5 text-[14px] font-medium">{money(v)}</dd>
    </div>
  );
}

function TripStrip({ brief }: { brief: BriefT }) {
  const { s } = useStore();
  return (
    <section className="mt-8" aria-label="Trip">
      <span className="eyebrow">The trip</span>
      <ol className="mt-2 border-t border-rule">
        {LEGS.map((leg) => {
          const a = brief.actions.find((x) => x.event.thread === leg.thread);
          const d = brief.decisions.find((x) => x.event.thread === leg.thread);
          const ds = d ? s.decisions[d.event.id] : undefined;
          let status: React.ReactNode = <Tag>Not started</Tag>;
          let price: number | null = null;
          if (a) {
            const undone = s.undone[a.event.id] === "undone";
            status = undone ? <Tag tone="bad">Cancelling</Tag> : <Tag tone="ok">Reserved</Tag>;
            price = undone ? null : a.option.price_cad;
          } else if (d) {
            if (ds && ds.status !== "open") {
              status = ds.choice ? <Tag tone="ink">You picked</Tag> : <Tag tone="bad">Declined</Tag>;
              price = ds.price;
            } else {
              status = (
                <a href="#needs-you">
                  <Tag tone="act">Needs you</Tag>
                </a>
              );
            }
          }
          return (
            <li key={leg.thread} className="flex items-center justify-between gap-3 border-b border-rule py-2">
              <div className="min-w-0">
                <span className="text-[14px] font-medium">{leg.label}</span>
                <span className="ml-2 text-[12px] text-muted">{leg.when}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {price !== null && <span className="num text-[13px]">{money(price)}</span>}
                {status}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ActionRow({ a, brief, onAudit }: { a: ActionView; brief: BriefT; onAudit: (id: string) => void }) {
  const { s, dispatch, now, queue } = useStore();
  const [open, setOpen] = useState(false);
  const state = s.undone[a.event.id];
  const o = a.option;
  const breach = !a.rule.withinPreauth;
  const audit = brief.audit.claims.find((c) => c.event_id === a.event.id || a.corrections.some((r) => r.id === c.event_id));

  const undo = () => {
    dispatch({ t: "undo", id: a.event.id, s: "undoing" });
    queue(`undo:${a.event.id}`, `Cancel ${o.label} while it's still free (before ${clock(o.cancel_by!)} ${day(o.cancel_by!)}).`);
    setTimeout(() => dispatch({ t: "undo", id: a.event.id, s: "undone" }), 700);
  };
  const keep = () => {
    dispatch({ t: "undo", id: a.event.id, s: null });
    queue(`undo:${a.event.id}`, null);
  };

  return (
    <article className={`border bg-card ${state === "undone" ? "border-rule opacity-70" : breach ? "border-bad" : "border-rule"}`}>
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className={`text-[15px] font-medium leading-snug ${state === "undone" ? "line-through decoration-muted" : ""}`}>{o.label}</h3>
          <span className="num shrink-0 text-[15px] font-semibold">{money(o.price_cad)}</span>
        </div>
        {a.corrections.map((c) => (
          <p key={c.id} className="mt-1 text-[12.5px] text-bad">
            Corrected {clock(c.ts)}: {money(o.history[0].price_cad)} → {money(o.price_cad)}. {c.title.split("—")[1]?.trim()}
          </p>
        ))}
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{a.event.detail}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <Tag tone={a.rule.refundable ? "ok" : "bad"}>{a.rule.refundable ? "✓" : "✕"} Refundable</Tag>
          <Tag tone={a.rule.cancelsAfterWake ? "ok" : "bad"}>{a.rule.cancelsAfterWake ? "✓" : "✕"} Cancel window past 8 AM</Tag>
          <Tag tone={breach ? "bad" : "ok"}>
            {breach ? "✕" : "✓"} Within {money(brief.spend.preauth)}
          </Tag>
          {audit && <AuditTag status={audit.status} onClick={() => onAudit(audit.event_id)} />}
          {o.flags.filter((f) => f.level !== "info").map((f) => <FlagTag key={f.text} f={f} />)}
        </div>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-rule px-4 py-2.5 text-[12.5px]">
        {state === "undone" ? (
          <>
            <span className="text-bad">Cancellation in your reply to Muse</span>
            <button type="button" onClick={keep} className="underline underline-offset-2">Keep it instead</button>
          </>
        ) : state === "undoing" ? (
          <span className="working">Adding cancellation…</span>
        ) : (
          <>
            <span className="text-muted">
              {o.cancel_by ? (
                <>
                  Free to cancel for <span className="num text-ink">{until(o.cancel_by, now)}</span>
                </>
              ) : (
                "Can't be cancelled"
              )}
              {a.alternatives.length > 0 && (
                <>
                  {" · "}
                  <button type="button" className="underline underline-offset-2" onClick={() => setOpen(!open)}>
                    {open ? "hide" : `${a.alternatives.length} other option${a.alternatives.length > 1 ? "s" : ""}`}
                  </button>
                </>
              )}
            </span>
            {o.cancel_by && (
              <Btn kind="secondary" className="!px-2.5 !py-1 !text-[12.5px]" onClick={undo}>
                Undo
              </Btn>
            )}
          </>
        )}
      </footer>
      {open && (
        <ul className="border-t border-rule bg-paper px-4 py-1">
          {a.alternatives.map((x) => (
            <li key={x.label} className="flex justify-between gap-3 py-1.5 text-[13px]">
              <span className="text-ink-2">{x.label}</span>
              <span className="num shrink-0">
                {money(x.price_cad)} <span className="text-muted">({money(x.price_cad - o.price_cad, { sign: true })})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function AssumptionRow({ e }: { e: LogEvent }) {
  const { s, dispatch, queue } = useStore();
  const cur = s.assumptions[e.id];
  const pick = (choice: string | null) => {
    dispatch({ t: "assume", id: e.id, choice });
    queue(`assume:${e.id}`, choice ? `You assumed "${e.title}". Actually: ${choice}. Redo anything this affects and tell me what changes.` : null);
  };
  return (
    <div className="border-b border-rule py-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className={`text-[14.5px] font-medium leading-snug ${cur?.choice ? "text-muted line-through" : ""}`}>{e.title}</h3>
        {e.confidence && <span className="shrink-0 text-[11px] text-muted">{e.confidence === "low" ? "a guess" : e.confidence === "med" ? "likely" : "confident"}</span>}
      </div>
      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{e.detail}</p>
      {cur?.choice && (
        <p className="mt-1 text-[13px] font-medium">
          → {cur.choice} <span className="font-normal text-muted">· Muse will redo what this affects</span>
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => pick(null)}
          className={`border px-2 py-1 text-[12.5px] ${!cur?.choice ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink"}`}
        >
          That&apos;s right
        </button>
        {(e.alternatives ?? []).map((alt) => (
          <button
            key={alt}
            type="button"
            onClick={() => pick(alt)}
            className={`border px-2 py-1 text-[12.5px] ${cur?.choice === alt ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink"}`}
          >
            {alt}
          </button>
        ))}
      </div>
    </div>
  );
}
