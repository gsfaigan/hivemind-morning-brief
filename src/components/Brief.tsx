"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActionView, Brief as BriefT } from "@/lib/derive";
import { clock, countWord, day, money, until } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStore } from "@/lib/store";
import type { LogEvent } from "@/lib/types";
import { AuditSheet } from "./AuditSheet";
import { DecisionCard, LEG_LABEL, NoteLines, OptionBody, headline } from "./DecisionCard";
import { Outbox } from "./Outbox";
import { Btn, Nav, Page, Section, Tag } from "./ui";

const LEGS = ["out", "nyc-stay", "nyc-bos", "bos-stay", "return"];

export function Brief({ brief }: { brief: BriefT }) {
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const live = useLive(brief);
  const { run } = brief;
  const verified = brief.audit.claims.filter((c) => c.status === "verified").length;
  const n = live.open.length;

  return (
    <Page>
      {run.sample && (
        <div className="mb-8 border border-warn px-4 py-2.5 text-[13px] text-warn">Sample data until the real overnight log is in.</div>
      )}
      <Nav here="brief" date={day(run.wake_at)} />

      <header className="mt-12 sm:mt-16">
        <h1 className="text-[40px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[52px]">Good morning, Gabe.</h1>
        <p className="mt-4 text-[19px] leading-snug text-ink-2 sm:text-[21px]">
          {n ? (
            <>
              <a href="#needs-you" className="text-act underline decoration-1 underline-offset-[5px]">
                {countWord(n)} decision{n === 1 ? "" : "s"} need{n === 1 ? "s" : ""} you.
              </a>{" "}
              The rest is handled.
            </>
          ) : (
            "Nothing needs you. Send your reply when ready."
          )}
        </p>
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-muted">
          <span>
            Muse worked {clock(run.started_at).replace(/\s?[AP]M/, "")}–{clock(run.ended_at)}
          </span>
          <button type="button" onClick={() => setAuditFor("all")} className="underline decoration-rule underline-offset-4 hover:text-ink">
            {verified} of {brief.audit.claims.length} facts check out
          </button>
          {brief.problemCount > 0 && <span className="text-bad">{brief.problemCount} flagged below</span>}
        </p>
      </header>

      <Budget brief={brief} />
      <Trip brief={brief} />

      {n > 0 && (
        <Section id="needs-you" label="Needs you" count={n}>
          <div className="space-y-8">
            {live.open.map((d) => (
              <DecisionCard key={d.event.id} d={d} brief={brief} onAudit={setAuditFor} />
            ))}
          </div>
        </Section>
      )}

      {live.decided.length > 0 && (
        <Section label="You decided" count={live.decided.length}>
          <div className="space-y-3">
            {live.decided.map((d) => (
              <DecisionCard key={d.event.id} d={d} brief={brief} onAudit={setAuditFor} />
            ))}
          </div>
        </Section>
      )}

      <Section label="Done without you" count={brief.actions.length} aside="Free to undo">
        <div className="border-t border-rule">
          {brief.actions.map((a) => (
            <ActionRow key={a.event.id} a={a} brief={brief} onAudit={setAuditFor} />
          ))}
        </div>
      </Section>

      <Section label="Assumptions" count={brief.assumptions.length}>
        <div className="border-t border-rule">
          {brief.assumptions.map((e) => (
            <AssumptionRow key={e.id} e={e} />
          ))}
        </div>
      </Section>

      <Section label="For your information" count={brief.updates.length}>
        <div className="border-t border-rule">
          {brief.updates.map((e) => (
            <UpdateRow key={e.id} e={e} />
          ))}
        </div>
        <Link href="/night" className="mt-6 inline-block text-[14px] text-muted underline decoration-rule underline-offset-4 hover:text-ink">
          The full night log
        </Link>
      </Section>

      <AuditSheet brief={brief} eventId={auditFor} onClose={() => setAuditFor(null)} />
      <Outbox brief={brief} />
    </Page>
  );
}

function Budget({ brief }: { brief: BriefT }) {
  const l = useLive(brief);
  const [open, setOpen] = useState(false);
  const max = Math.max(l.budget, l.projected) * 1.04;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const left = l.budget - l.projected;
  return (
    <section className="mt-14 sm:mt-20" aria-label="Budget">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <span className={`num text-[34px] font-semibold tracking-[-0.02em] ${left < 0 ? "text-bad" : ""}`}>{money(Math.abs(left))}</span>
          <span className="ml-2 text-[15px] text-muted">{left >= 0 ? "left" : "over"} of {money(l.budget)}</span>
        </div>
        <button type="button" onClick={() => setOpen(!open)} className="text-[13px] text-muted underline decoration-rule underline-offset-4 hover:text-ink">
          {open ? "Hide" : "Breakdown"}
        </button>
      </div>
      <div className="relative mt-4 h-2.5 bg-rule/60">
        <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: pct(l.reserved) }} title={`Reserved ${money(l.reserved)}`} />
        <div className="absolute inset-y-0 bg-ink-2" style={{ left: pct(l.reserved), width: pct(l.chosen) }} title={`Your picks ${money(l.chosen)}`} />
        <div className="absolute inset-y-0 bg-muted/50" style={{ left: pct(l.reserved + l.chosen), width: pct(l.pending) }} title={`Waiting on you ${money(l.pending)}`} />
        <div className="absolute -inset-y-2 w-px bg-act" style={{ left: pct(l.preauth) }} />
        <div className="absolute -inset-y-2 w-0.5 bg-ink" style={{ left: pct(l.budget) }} />
      </div>
      <div className="relative mt-2 h-4 text-[12px]">
        <span className="absolute -translate-x-1/2 whitespace-nowrap text-act" style={{ left: pct(l.preauth) }}>
          {money(l.preauth)} overnight limit
        </span>
      </div>
      {open && (
        <dl className="mt-5 grid grid-cols-3 gap-4 text-[13px]">
          {[
            ["bg-ink", "Reserved", l.reserved],
            ["bg-ink-2", "Your picks", l.chosen],
            ["bg-muted/50", "Waiting on you", l.pending],
          ].map(([sw, k, v]) => (
            <div key={k as string}>
              <dt className="flex items-center gap-2 text-muted">
                <span aria-hidden className={`inline-block size-2.5 ${sw}`} />
                {k}
              </dt>
              <dd className="num mt-1 text-[15px] font-medium">{money(v as number)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

function Trip({ brief }: { brief: BriefT }) {
  const { s } = useStore();
  return (
    <section className="mt-12" aria-label="Trip">
      <ol className="border-t border-rule">
        {LEGS.map((t) => {
          const a = brief.actions.find((x) => x.event.thread === t);
          const d = brief.decisions.find((x) => x.event.thread === t);
          const ds = d ? s.decisions[d.event.id] : undefined;
          let tag = <Tag>Not started</Tag>;
          let price: number | null = null;
          if (a) {
            const undone = s.undone[a.event.id] === "undone";
            tag = undone ? <Tag tone="problem">Cancelling</Tag> : <Tag tone="ok">Reserved</Tag>;
            price = undone ? null : a.option.price_cad;
          } else if (d && ds && ds.status !== "open") {
            tag = ds.choice ? <Tag tone="pick">Your pick</Tag> : <Tag tone="problem">Declined</Tag>;
            price = ds.price;
          } else if (d) {
            tag = <Tag tone="act">Needs you</Tag>;
          }
          const [name, when] = (LEG_LABEL[t] ?? t).split(" · ");
          return (
            <li key={t} className="flex items-center justify-between gap-4 border-b border-rule py-3.5">
              <div className="min-w-0">
                <span className="text-[15px] font-medium">{name}</span>
                <span className="ml-3 text-[13px] text-muted">{when}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {price ? <span className="num text-[14px]">{money(price)}</span> : null}
                {tag}
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
    <article className={`border-b border-rule py-6 ${state === "undone" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{(LEG_LABEL[a.event.thread ?? ""] ?? "").split(" · ")[0]}</div>
          <h3 className={`mt-2 text-[17px] font-medium leading-snug ${state === "undone" ? "line-through decoration-muted" : ""}`}>{headline(a.event)}</h3>
        </div>
        <span className="num shrink-0 pt-6 text-[17px] font-semibold">{money(o.price_cad)}</span>
      </div>

      {a.corrections.map((c) => (
        <button key={c.id} type="button" onClick={() => onAudit(c.id)} className="mt-2 block text-left text-[13.5px] text-bad hover:underline">
          Corrected from {money(o.history[0].price_cad)}: {c.summary ?? c.title}
        </button>
      ))}
      {breach && !a.corrections.length && <p className="mt-2 text-[13.5px] text-bad">Over your {money(brief.spend.preauth)} overnight limit.</p>}
      <NoteLines notes={notes} onAudit={onAudit} />

      <div className="mt-4 flex items-center justify-between gap-4 text-[13.5px]">
        {state === "undone" ? (
          <>
            <span className="text-bad">Cancellation in your reply</span>
            <button type="button" onClick={keep} className="text-muted underline decoration-rule underline-offset-4 hover:text-ink">
              Keep it
            </button>
          </>
        ) : state === "undoing" ? (
          <span className="working">Adding cancellation…</span>
        ) : (
          <>
            <span className="text-muted">
              {o.cancel_by ? <>Free to cancel for <span className="num text-ink">{until(o.cancel_by, now)}</span></> : "Can't be cancelled"}
              <span className="mx-2">·</span>
              <button type="button" className="underline decoration-rule underline-offset-4 hover:text-ink" onClick={() => setOpen(!open)}>
                {open ? "Less" : "Details"}
              </button>
            </span>
            {o.cancel_by && (
              <Btn kind="secondary" className="!px-3.5 !py-1.5 !text-[13.5px]" onClick={undo}>
                Undo
              </Btn>
            )}
          </>
        )}
      </div>

      {open && (
        <div className="mt-5 border-l border-rule-strong pl-4">
          <OptionBody o={o} onAudit={() => onAudit(a.event.id)} />
          {a.event.summary && <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{a.event.summary}</p>}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Tag tone={a.rule.refundable ? "status" : "problem"}>{a.rule.refundable ? "Refundable" : "Not refundable"}</Tag>
            <Tag tone={a.rule.cancelsAfterWake ? "status" : "problem"}>{a.rule.cancelsAfterWake ? "Undo window past 8 AM" : "Undo window closes overnight"}</Tag>
            <Tag tone={breach ? "problem" : "status"}>{breach ? `Over ${money(brief.spend.preauth)}` : `Within ${money(brief.spend.preauth)}`}</Tag>
          </div>
          {a.alternatives.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-[13.5px]">
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
  const chip = (active: boolean) =>
    `border px-3 py-1.5 text-[13.5px] ${active ? "border-ink bg-ink text-paper" : "border-rule text-ink-2 hover:border-ink"}`;
  return (
    <div className="border-b border-rule py-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className={`text-[17px] font-medium leading-snug ${cur?.choice ? "text-muted line-through decoration-muted" : ""}`}>{headline(e)}</h3>
        <button type="button" onClick={() => setOpen(!open)} className="shrink-0 text-[13px] text-muted underline decoration-rule underline-offset-4 hover:text-ink">
          {open ? "Hide" : "Why"}
        </button>
      </div>
      {cur?.choice && <p className="mt-1.5 text-[15px] font-medium">{cur.choice}</p>}
      {open && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.summary ?? e.detail}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => pick(null)} className={chip(!cur?.choice)}>
          Right
        </button>
        {(e.alternatives ?? []).map((alt) => (
          <button key={alt} type="button" onClick={() => pick(alt)} className={chip(cur?.choice === alt)}>
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
    <button type="button" onClick={() => setOpen(!open)} className="block w-full border-b border-rule py-4 text-left">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[15.5px] leading-snug">{headline(e)}</span>
        <span className="num shrink-0 text-[13px] text-muted">{clock(e.ts)}</span>
      </div>
      {open && <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{e.summary ?? e.detail}</p>}
    </button>
  );
}
