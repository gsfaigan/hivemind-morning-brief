"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActionView, Brief as BriefT } from "@/lib/derive";
import { clock, countWord, day, minutes, money, until } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStore } from "@/lib/store";
import type { Kind, LogEvent } from "@/lib/types";
import { AuditSheet } from "./AuditSheet";
import { DecisionCard, LEG_LABEL, NoteLines, OptionBody, headline } from "./DecisionCard";
import { Outbox } from "./Outbox";
import { Btn, Nav, Page, Panel, Section, Tag } from "./ui";

export function Brief({ brief }: { brief: BriefT }) {
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const live = useLive(brief);

  return (
    <>
      <NightHero brief={brief} onAudit={() => setAuditFor("all")} />

      <Page className="pt-10 sm:pt-14">
        <TripCard brief={brief} />

        {live.open.length > 0 && (
          <Section id="needs-you" label="Needs you" count={live.open.length}>
            <div className="space-y-6">
              {live.open.map((d) => (
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

        <Section label="Done without you" count={brief.actions.length} aside="Free to undo">
          <Panel className="divide-y divide-rule">
            {brief.actions.map((a) => (
              <ActionRow key={a.event.id} a={a} brief={brief} onAudit={setAuditFor} />
            ))}
          </Panel>
        </Section>

        <Section label="Assumptions" count={brief.assumptions.length}>
          <Panel className="divide-y divide-rule">
            {brief.assumptions.map((e) => (
              <AssumptionRow key={e.id} e={e} />
            ))}
          </Panel>
        </Section>

        <Section label="FYI" count={brief.updates.length}>
          <Panel className="divide-y divide-rule">
            {brief.updates.map((e) => (
              <UpdateRow key={e.id} e={e} />
            ))}
          </Panel>
          <Link href="/night" className="mt-6 inline-block text-[15px] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
            See the full night log
          </Link>
        </Section>
      </Page>

      <AuditSheet brief={brief} eventId={auditFor} onClose={() => setAuditFor(null)} />
      <Outbox brief={brief} />
    </>
  );
}

// On vermilion, kinds are told apart by height and strength, not hue.
export const TICK: Record<Kind, string> = {
  decision: "bg-white h-12",
  would_book: "bg-white/75 h-9",
  mistake: "bg-[#1d1d1f] h-9",
  assumption: "bg-white/50 h-6",
  update: "bg-white/35 h-5",
  search: "bg-white/20 h-3",
};

// The night, as a dark band: when Muse worked, what happened when, and the
// one thing the user needs to know.
function NightHero({ brief, onAudit }: { brief: BriefT; onAudit: () => void }) {
  const live = useLive(brief);
  const { run, timeline } = brief;
  const n = live.open.length;
  const t0 = new Date(run.started_at).getTime();
  const t1 = new Date(run.wake_at).getTime();
  const worked = Math.round((new Date(run.ended_at).getTime() - t0) / 60000);
  const searches = timeline.find((e) => /\d+ searches/.test(e.detail))?.detail.match(/(\d+) searches/)?.[1];
  const verified = brief.audit.claims.filter((c) => c.status === "verified").length;

  return (
    <header className="hero">
      <div className="mx-auto w-full max-w-[760px] px-5 sm:px-10">
        <Nav here="brief" date={day(run.wake_at)} />

        <div className="pb-14 pt-16 sm:pb-20 sm:pt-24">
          <h1 className="rise text-[44px] font-semibold leading-[1] tracking-[-0.04em] sm:text-[72px]">Good morning, Gabe.</h1>
          <p className="rise mt-5 text-[20px] leading-snug text-ink-2 [animation-delay:80ms] sm:text-[24px]">
            {n ? (
              <>
                <a href="#needs-you" className="font-semibold underline decoration-2 underline-offset-[6px]">
                  {countWord(n)} decision{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} you.
                </a>{" "}
                The rest is handled.
              </>
            ) : (
              "Nothing needs you. The rest is handled."
            )}
          </p>

          <div className="mt-14 sm:mt-20" aria-hidden>
            <div className="relative h-12">
              {timeline.map((e) => {
                const x = ((new Date(e.ts).getTime() - t0) / (t1 - t0)) * 100;
                return <span key={e.id} className={`absolute bottom-0 w-[3px] ${TICK[e.kind]}`} style={{ left: `${x}%` }} />;
              })}
            </div>
            <div className="h-px bg-rule" />
            <div className="num mt-2 flex justify-between text-[12px] text-muted">
              <span>{clock(run.started_at)}</span>
              <span>{clock(run.wake_at)}</span>
            </div>
          </div>

          <dl className="mt-10 grid grid-cols-3 gap-4">
            <Stat k="Worked" v={minutes(worked)} />
            <Stat k="Searches" v={searches ?? String(brief.searches.length)} />
            <div>
              <dt className="text-[13px] text-muted">Checked</dt>
              <dd className="mt-1">
                <button type="button" onClick={onAudit} className="num text-[26px] font-semibold tracking-[-0.02em] underline decoration-white/40 decoration-2 underline-offset-[6px] hover:decoration-white sm:text-[32px]">
                  {verified}/{brief.audit.claims.length}
                </button>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </header>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[13px] text-muted">{k}</dt>
      <dd className="num mt-1 text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">{v}</dd>
    </div>
  );
}

type LegState = { kind: "reserved" | "picked" | "needs" | "cancelled" | "declined" | "none"; price: number | null };

function useLegs(brief: BriefT) {
  const { s } = useStore();
  return (t: string): LegState => {
    const a = brief.actions.find((x) => x.event.thread === t);
    const d = brief.decisions.find((x) => x.event.thread === t);
    if (a) return s.undone[a.event.id] === "undone" ? { kind: "cancelled", price: null } : { kind: "reserved", price: a.option.price_cad };
    if (d) {
      const ds = s.decisions[d.event.id];
      if (ds && ds.status !== "open") return ds.choice ? { kind: "picked", price: ds.price } : { kind: "declined", price: null };
      return { kind: "needs", price: null };
    }
    return { kind: "none", price: null };
  };
}

function LegLabel({ st }: { st: LegState }) {
  if (st.kind === "needs")
    return (
      <a href="#needs-you" className="font-semibold text-act hover:underline">
        Needs you
      </a>
    );
  if (st.kind === "cancelled") return <span className="text-bad">Cancelling</span>;
  if (st.kind === "declined") return <span className="text-bad">Declined</span>;
  if (st.kind === "none") return <span className="text-muted">Not started</span>;
  return <span className="num text-ink-2">{money(st.price ?? 0)}</span>;
}

const segCls = (st: LegState) =>
  st.kind === "needs"
    ? "border-t-2 border-dashed border-act"
    : st.kind === "cancelled" || st.kind === "declined"
      ? "border-t-2 border-dashed border-bad"
      : st.kind === "none"
        ? "border-t-2 border-dotted border-rule"
        : "border-t-2 border-ink";

function Node({ st, end }: { st?: LegState; end?: boolean }) {
  const cls = end
    ? "bg-ink"
    : st?.kind === "needs"
      ? "border-2 border-act bg-card"
      : st?.kind === "cancelled" || st?.kind === "declined"
        ? "border-2 border-bad bg-card"
        : "bg-ink";
  return <span className={`relative z-10 block size-3.5 shrink-0 ${cls}`} />;
}

// Budget and route in one card: the trip at a glance.
function TripCard({ brief }: { brief: BriefT }) {
  const l = useLive(brief);
  const leg = useLegs(brief);
  const [open, setOpen] = useState(false);
  const max = Math.max(l.budget, l.projected) * 1.03;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const left = l.budget - l.projected;

  const cities: { name: string; sub: React.ReactNode; st?: LegState; end?: boolean; align: string }[] = [
    { name: "Toronto", sub: <span className="text-muted">Oct 10</span>, end: true, align: "left-0" },
    { name: "New York", sub: <LegLabel st={leg("nyc-stay")} />, st: leg("nyc-stay"), align: "left-1/2 -translate-x-1/2 text-center" },
    { name: "Boston", sub: <LegLabel st={leg("bos-stay")} />, st: leg("bos-stay"), align: "left-1/2 -translate-x-1/2 text-center" },
    { name: "Toronto", sub: <span className="text-muted">Oct 18</span>, end: true, align: "right-0 text-right" },
  ];
  const segs = [leg("out"), leg("nyc-bos"), leg("return")];

  return (
    <Panel className="p-6 sm:p-10">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-[13px] font-semibold text-muted">Reading week</div>
        <button type="button" onClick={() => setOpen(!open)} className="text-[14px] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          {open ? "Hide breakdown" : "Breakdown"}
        </button>
      </div>
      <div className="mt-2">
        <span className={`num text-[48px] font-semibold leading-none tracking-[-0.04em] sm:text-[64px] ${left < 0 ? "text-bad" : ""}`}>
          {money(Math.abs(left))}
        </span>
        <span className="ml-3 text-[17px] text-muted">
          {left >= 0 ? "left" : "over"} of {money(l.budget)}
        </span>
      </div>

      <div className="relative mt-7 h-2 bg-fill">
        <div className="absolute inset-y-0 left-0 bg-ink transition-all duration-500" style={{ width: pct(l.reserved) }} />
        <div className="absolute inset-y-0 bg-ink-2 transition-all duration-500" style={{ left: pct(l.reserved), width: pct(l.chosen) }} />
        <div className="absolute inset-y-0 bg-act transition-all duration-500" style={{ left: pct(l.reserved + l.chosen), width: pct(l.pending) }} />
        <div className="absolute -inset-y-2 w-px bg-muted" style={{ left: pct(l.preauth) }} />
      </div>
      <div className="relative mt-2.5 h-4 text-[12px] text-muted">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(l.preauth) }}>
          {money(l.preauth)} overnight limit
        </span>
      </div>
      {open && (
        <dl className="mt-6 grid grid-cols-3 gap-4 text-[13px]">
          {[
            ["bg-ink", "Reserved", l.reserved],
            ["bg-ink-2", "Your picks", l.chosen],
            ["bg-act", "Waiting on you", l.pending],
          ].map(([sw, k, v]) => (
            <div key={k as string}>
              <dt className="flex items-center gap-2 text-muted">
                <span aria-hidden className={`inline-block size-2.5 ${sw}`} />
                {k}
              </dt>
              <dd className="num mt-1 text-[17px] font-semibold">{money(v as number)}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* The route: cities are stays, lines are travel. */}
      <div className="mt-12 pb-14 pt-8" aria-label="Route">
        <div className="flex items-center">
          {cities.map((c, i) => (
            <div key={i} className={`relative flex items-center ${i < 3 ? "flex-1" : ""}`}>
              <div className="relative">
                <Node st={c.st} end={c.end} />
                <div className={`absolute top-6 whitespace-nowrap ${c.align}`}>
                  <div className="text-[15px] font-semibold">{c.name}</div>
                  <div className="mt-0.5 text-[13px]">{c.sub}</div>
                </div>
              </div>
              {i < 3 && (
                <div className="relative mx-1 flex-1">
                  <div className={segCls(segs[i])} />
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[13px]">
                    <LegLabel st={segs[i]} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ActionRow({ a, brief, onAudit }: { a: ActionView; brief: BriefT; onAudit: (id: string) => void }) {
  const { s, dispatch, now, queue } = useStore();
  const [open, setOpen] = useState(false);
  const state = s.undone[a.event.id];
  const o = a.option;
  const breach = !a.rule.withinPreauth;
  const notes = brief.threadNotes[a.event.thread ?? ""] ?? [];

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
    <article className={`px-6 py-6 sm:px-8 ${state === "undone" ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{(LEG_LABEL[a.event.thread ?? ""] ?? "").split(" · ")[0]}</div>
          <h3 className={`mt-1 text-[18px] font-semibold leading-snug tracking-[-0.01em] ${state === "undone" ? "line-through decoration-muted" : ""}`}>
            {headline(a.event)}
          </h3>
        </div>
        <span className="num shrink-0 pt-5 text-[18px] font-semibold">{money(o.price_cad)}</span>
      </div>

      {a.corrections.map((c) => (
        <button key={c.id} type="button" onClick={() => onAudit(c.id)} className="mt-2 block text-left text-[14px] text-bad hover:underline">
          Corrected from {money(o.history[0].price_cad)}. {c.summary ?? c.title}
        </button>
      ))}
      {breach && !a.corrections.length && <p className="mt-2 text-[14px] text-bad">Over your {money(brief.spend.preauth)} overnight limit.</p>}
      <NoteLines notes={notes} onAudit={onAudit} />

      <div className="mt-5 flex items-center justify-between gap-4 text-[14px]">
        {state === "undone" ? (
          <>
            <span className="text-bad">Cancellation in your reply</span>
            <button type="button" onClick={keep} className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
              Keep it
            </button>
          </>
        ) : state === "undoing" ? (
          <span className="working">Adding cancellation…</span>
        ) : (
          <>
            <span className="flex flex-col items-start gap-1 text-muted sm:flex-row sm:items-baseline sm:gap-5">
              <span>
                {o.cancel_by ? (
                  <>
                    Free to cancel for <span className="num text-ink">{until(o.cancel_by, now)}</span>
                  </>
                ) : (
                  "Can't be cancelled"
                )}
              </span>
              <button type="button" className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink" onClick={() => setOpen(!open)}>
                {open ? "Less" : "Details"}
              </button>
            </span>
            {o.cancel_by && (
              <Btn kind="secondary" className="!px-4 !py-1.5 !text-[14px]" onClick={undo}>
                Undo
              </Btn>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="mt-6 bg-paper p-5">
          <OptionBody o={o} onAudit={() => onAudit(a.event.id)} />
          {a.event.summary && <p className="mt-4 text-[14.5px] leading-relaxed text-ink-2">{a.event.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Tag tone={a.rule.refundable ? "status" : "problem"}>{a.rule.refundable ? "Refundable" : "Not refundable"}</Tag>
            <Tag tone={a.rule.cancelsAfterWake ? "status" : "problem"}>{a.rule.cancelsAfterWake ? "Undo window past 8 AM" : "Undo window closes overnight"}</Tag>
            <Tag tone={breach ? "problem" : "status"}>{breach ? `Over ${money(brief.spend.preauth)}` : `Within ${money(brief.spend.preauth)}`}</Tag>
          </div>
          {a.alternatives.length > 0 && (
            <ul className="mt-5 space-y-2 text-[14px]">
              {a.alternatives.map((x) => (
                <li key={x.label} className="flex justify-between gap-4 text-ink-2">
                  <span>{x.label}</span>
                  <span className="num shrink-0 text-muted">{money(x.price_cad - o.price_cad, { sign: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}

function AssumptionRow({ e }: { e: LogEvent }) {
  const { s, dispatch, queue } = useStore();
  const [open, setOpen] = useState(false);
  const cur = s.assumptions[e.id];
  const pick = (choice: string | null) => {
    dispatch({ t: "assume", id: e.id, choice });
    queue(`assume:${e.id}`, choice ? `You assumed "${headline(e)}". Actually: ${choice}. Redo anything this affects and tell me what changes.` : null);
  };
  const seg = (active: boolean) =>
    `shrink-0 whitespace-nowrap px-3.5 py-1.5 text-[14px] transition-colors ${active ? "bg-card font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-ink-2 hover:text-ink"}`;
  return (
    <div className="px-6 py-6 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <h3 className={`text-[18px] font-semibold leading-snug tracking-[-0.01em] ${cur?.choice ? "text-muted line-through decoration-muted" : ""}`}>{headline(e)}</h3>
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-[14px] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          {open ? "Hide" : "Why"}
        </button>
      </div>
      {cur?.choice && <p className="mt-1.5 text-[16px] font-semibold">{cur.choice}</p>}
      {open && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{e.summary ?? e.detail}</p>}
      {/* A segmented control: the current reading, or one of the alternatives. */}
      <div className="mt-4 flex max-w-full gap-0.5 overflow-x-auto bg-fill p-0.5 sm:inline-flex">
        <button type="button" onClick={() => pick(null)} className={seg(!cur?.choice)}>
          As assumed
        </button>
        {(e.alternatives ?? []).map((alt) => (
          <button key={alt} type="button" onClick={() => pick(alt)} className={seg(cur?.choice === alt)}>
            {alt}
          </button>
        ))}
      </div>
    </div>
  );
}

function UpdateRow({ e }: { e: LogEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" onClick={() => setOpen(!open)} className="block w-full px-6 py-4 text-left transition-colors hover:bg-paper/60 sm:px-8">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[16px] leading-snug">{headline(e)}</span>
        <span className="num shrink-0 text-[13px] text-muted">{clock(e.ts)}</span>
      </div>
      {open && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{e.summary ?? e.detail}</p>}
    </button>
  );
}
