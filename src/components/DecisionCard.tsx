"use client";

import { useEffect, useState } from "react";
import type { Brief, DecisionView, OptionView } from "@/lib/derive";
import { clock, money, until } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStore, type Replan } from "@/lib/store";
import type { LogEvent } from "@/lib/types";
import type { ReplanOption } from "@/app/api/replan/route";
import { Btn, FlagTag, Route, Tag } from "./ui";
import { Recheck } from "./Recheck";

export const LEG_LABEL: Record<string, string> = {
  out: "Outbound · Sat Oct 10",
  "nyc-stay": "New York stay · Oct 10–14",
  "nyc-bos": "To Boston · Wed Oct 14",
  "bos-stay": "Boston stay · Oct 14–18",
  return: "Return · Sun Oct 18",
};

const REDIRECT_CHIPS: Record<string, string[]> = {
  return: ["Direct only, I'll go a little over", "Home by 3 PM", "Cheaper, any way home"],
  "nyc-stay": ["Private room, central, under $500", "Under 20 min from Midtown", "Somewhere in Brooklyn"],
};

export const headline = (e: LogEvent) => e.headline ?? e.title;

export function Why({ e }: { e: LogEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(!open)} className="text-[14px] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
        {open ? "Hide" : "Why"}
      </button>
      {open && (
        <div className="mt-3 bg-paper p-4 text-[14.5px] leading-relaxed text-ink-2">
          <p>{e.detail}</p>
          <p className="mt-1.5 text-[12.5px] text-muted">Muse, {clock(e.ts)}</p>
        </div>
      )}
    </div>
  );
}

// Mistakes and lapsed fares that belong to this leg, one line each.
export function NoteLines({ notes, onAudit }: { notes: LogEvent[]; onAudit: (id: string) => void }) {
  if (!notes.length) return null;
  return (
    <div className="mt-4 space-y-1.5">
      {notes.map((n) => (
        <button key={n.id} type="button" onClick={() => onAudit(n.id)} className="flex items-baseline gap-2.5 text-left text-[13.5px] hover:underline">
          <span aria-hidden className={`inline-block size-1.5 shrink-0 -translate-y-0.5 ${n.kind === "mistake" ? "bg-bad" : "bg-warn"}`} />
          <span className={n.kind === "mistake" ? "text-bad" : "text-ink-2"}>
            {n.kind === "mistake" ? "Fixed overnight: " : ""}
            {headline(n)}
          </span>
        </button>
      ))}
    </div>
  );
}

export function OptionBody({ o, onAudit, status }: { o: OptionView; onAudit?: () => void; status?: React.ReactNode }) {
  const x = o.facts ?? {};
  return (
    <>
      <div className="text-[17px] font-semibold leading-snug tracking-[-0.01em]">{o.label.replace(/\s*\((?:with taxes|expired)\)$/i, "")}</div>
      {o.sub && <div className="mt-0.5 text-[14px] text-muted">{o.sub}</div>}
      {(x.from || x.depart) && (
        <div className="mt-3">
          <Route from={x.from} to={x.to} depart={x.depart} arrive={x.arrive} />
        </div>
      )}
      {!x.from && x.nights && (
        <div className="mt-0.5 text-[14px] text-muted">
          {x.nights} nights{x.commute_min && x.commute_min < 35 ? ` · ${x.commute_min} min to the sights` : ""}
        </div>
      )}
      {(o.flags.length > 0 || status) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {status}
          {o.flags.map((f) => (
            <FlagTag key={f.text} f={f} onClick={f.kind === "problem" ? onAudit : undefined} />
          ))}
        </div>
      )}
      {o.audit && (o.audit.status === "conflict" || o.audit.status === "unsourced") && (
        <p className="mt-2 text-[13.5px] leading-snug text-bad">{o.audit.note}</p>
      )}
    </>
  );
}

export function DecisionCard({ d, brief, onAudit }: { d: DecisionView; brief: Brief; onAudit: (id: string) => void }) {
  const { s, dispatch, now, queue } = useStore();
  const live = useLive(brief);
  const st = s.decisions[d.event.id] ?? { status: "open" as const };
  const replan = s.replans[d.event.id];
  const [sel, setSel] = useState<string>(d.recommended ?? d.options[0]?.label);
  const [redirecting, setRedirecting] = useState(false);
  const [text, setText] = useState("");
  const recPrice = d.options.find((o) => o.label === d.recommended)?.price_cad ?? 0;
  const thread = d.event.thread ?? "";
  const leg = LEG_LABEL[thread] ?? "Decision";
  const notes = brief.threadNotes[thread] ?? [];

  const choose = (label: string | null, price: number | null, line: string) => {
    dispatch({ t: "decision", id: d.event.id, s: { status: "sending", choice: label, price, at: Date.now() } });
    queue(`decision:${d.event.id}`, line);
    // Optimistic: it's in the reply immediately; the short beat just
    // acknowledges the tap before the card collapses.
    setTimeout(() => dispatch({ t: "decision", id: d.event.id, s: { status: "queued", choice: label, price, at: Date.now() } }), 700);
  };

  const reopen = () => {
    dispatch({ t: "decision", id: d.event.id, s: { status: "open" } });
    queue(`decision:${d.event.id}`, null);
  };

  const sendRedirect = async (instruction: string) => {
    if (!instruction.trim()) return;
    const started = Date.now();
    dispatch({ t: "replan", id: d.event.id, r: { status: "thinking", text: instruction, startedAt: started } });
    setRedirecting(false);
    try {
      const committedElsewhere = live.projected - (st.status === "open" ? recPrice : (st.price ?? 0));
      const res = await fetch("/api/replan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction,
          decision: {
            title: d.event.title,
            detail: d.event.detail,
            recommended: d.recommended,
            options: d.options.map((o) => ({ label: o.label, price_cad: o.price_cad, refundable: o.refundable, held: o.held, facts: o.facts, note: o.sub ?? o.note })),
          },
          budget: { total: live.budget, committedElsewhere },
          trip: `${brief.run.task} Traveller is a university student from Waterloo, Ontario. Current plan: ${brief.actions.map((a) => a.option.label).join("; ")}.`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      dispatch({ t: "replan", id: d.event.id, r: { status: "done", text: instruction, result: json, ms: Date.now() - started } });
    } catch (e) {
      dispatch({ t: "replan", id: d.event.id, r: { status: "error", text: instruction, error: e instanceof Error ? e.message : "failed" } });
    }
  };

  if (st.status !== "open") {
    return (
      <div className="bg-card px-6 py-5 sm:px-8">
        <div className="eyebrow">{leg}</div>
        <div className="mt-1 flex items-baseline justify-between gap-4">
          <div className="text-[17px] font-semibold">{st.choice ?? "None of these"}</div>
          {st.price !== null && st.price > 0 && <div className="num text-[17px] font-semibold">{money(st.price)}</div>}
        </div>
        <div className="mt-2 flex items-center justify-between text-[14px] text-muted">
          <span>{st.status === "sending" ? <span className="working">Adding to your reply…</span> : "In your reply to Muse"}</span>
          <button type="button" onClick={reopen} className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
            Change
          </button>
        </div>
      </div>
    );
  }

  return (
    <article className="rise bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="px-6 pb-6 pt-7 sm:px-10 sm:pt-10">
        {d.expires_at && <div className="num mb-3 text-[13px] font-semibold text-warn">Hold ends in {until(d.expires_at, now)}</div>}
        <h3 className="text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[34px]">{headline(d.event)}</h3>
        {d.event.summary && <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{d.event.summary}</p>}
        <NoteLines notes={notes} onAudit={onAudit} />
        <Why e={d.event} />
      </div>

      <fieldset>
        <legend className="sr-only">Options</legend>
        {d.options.map((o) => {
          const delta = o.price_cad - recPrice;
          const total = live.totalIf(d.event.id, o.price_cad);
          const over = total - live.budget;
          const picked = sel === o.label;
          const isPick = o.label === d.recommended;
          return (
            <label
              key={o.label}
              className={`relative block cursor-pointer border-t border-rule px-6 py-6 transition-colors sm:px-10 ${picked ? "bg-act-bg/40" : "hover:bg-paper/50"}`}
            >
              {picked && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-act" />}
              <div className="flex items-start gap-4">
                <input
                  type="radio"
                  name={d.event.id}
                  checked={picked}
                  onChange={() => setSel(o.label)}
                  className="mt-1 size-[18px] shrink-0 accent-[var(--act)]"
                />
                <div className="min-w-0 flex-1">
                  <OptionBody
                    o={o}
                    onAudit={() => onAudit(d.event.id)}
                    status={
                      (isPick || o.held) && (
                        <>
                          {isPick && <Tag tone="pick">Muse&apos;s pick</Tag>}
                          {o.held && <Tag>On hold</Tag>}
                        </>
                      )
                    }
                  />
                  {picked && (
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                      <span className={over > 0 ? "text-bad" : ""}>
                        {over > 0 ? `${money(over)} over budget` : `${money(-over)} left in budget`}
                      </span>
                      {o.checked_at && <Recheck o={o} when={leg} checkedAt={o.checked_at} />}
                    </div>
                  )}
                </div>
                <div className="num shrink-0 text-right">
                  <div className="text-[20px] font-semibold tracking-[-0.02em]">{money(o.price_cad)}</div>
                  {!isPick && <div className={`mt-0.5 text-[13px] ${delta > 0 ? "text-muted" : "text-ok"}`}>{money(delta, { sign: true })}</div>}
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      {replan && (
        <ReplanPanel
          r={replan}
          onPick={(o, instr) => choose(o.label, o.price_cad, instr)}
          onDismiss={() => dispatch({ t: "replan", id: d.event.id, r: null })}
        />
      )}

      {redirecting ? (
        <div className="border-t border-rule px-6 py-6 sm:px-10">
          <label htmlFor={`r-${d.event.id}`} className="text-[15px] font-semibold">
            What do you want instead?
          </label>
          <textarea
            id={`r-${d.event.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            className="mt-3 w-full resize-none bg-paper px-4 py-3.5 text-[16px] outline-none ring-act focus:ring-2"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(REDIRECT_CHIPS[thread] ?? ["Cheaper", "More comfortable"]).map((c) => (
              <button key={c} type="button" onClick={() => setText(c)} className="bg-fill px-3 py-1.5 text-[13.5px] text-ink-2 hover:text-ink">
                {c}
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <Btn kind="primary" onClick={() => sendRedirect(text)} disabled={!text.trim()}>
              Re-plan
            </Btn>
            <Btn kind="ghost" onClick={() => setRedirecting(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      ) : (
        <footer className="flex flex-wrap items-center gap-3 border-t border-rule px-6 py-6 sm:px-10">
          <Btn
            kind="act"
            onClick={() => {
              const o = d.options.find((x) => x.label === sel)!;
              choose(o.label, o.price_cad, `${leg}: go with ${o.label} (${money(o.price_cad)}).${o.held ? " Use the hold." : ""}`);
            }}
          >
            {sel === d.recommended ? "Book Muse's pick" : "Book this one"}
          </Btn>
          <Btn kind="secondary" onClick={() => setRedirecting(true)} disabled={replan?.status === "thinking"}>
            Redirect
          </Btn>
          <Btn kind="ghost" className="ml-auto" onClick={() => choose(null, 0, `${leg}: none of these. Release any hold and don't book yet.`)}>
            None of these
          </Btn>
        </footer>
      )}
    </article>
  );
}

const STAGES = [
  [0, "Reading Muse's options"],
  [2500, "Searching live fares"],
  [7000, "Checking your budget"],
  [14000, "Still searching. You can keep going, this card will update"],
] as const;

function ReplanPanel({
  r,
  onPick,
  onDismiss,
}: {
  r: Replan;
  onPick: (o: ReplanOption & { price_cad: number }, instruction: string) => void;
  onDismiss: () => void;
}) {
  const [el, setEl] = useState(0);
  const startedAt = r.status === "thinking" ? r.startedAt : 0;
  useEffect(() => {
    if (!startedAt) return;
    const i = setInterval(() => setEl(Date.now() - startedAt), 500);
    return () => clearInterval(i);
  }, [startedAt]);

  if (r.status === "thinking") {
    const stage = [...STAGES].reverse().find(([t]) => el >= t)![1];
    return (
      <div className="border-t border-rule bg-paper px-6 py-6 sm:px-10">
        <div className="text-[13px] text-muted">&ldquo;{r.text}&rdquo;</div>
        <div className="mt-3 flex items-center gap-3 text-[15px]">
          <span className="working inline-block size-2 bg-act" aria-hidden />
          <span>{stage}…</span>
          <span className="num ml-auto text-[13px] text-muted">{Math.floor(el / 1000)}s</span>
        </div>
      </div>
    );
  }

  if (r.status === "error") {
    return (
      <div className="border-t border-rule bg-bad-bg px-6 py-5 text-[14px] text-bad sm:px-10">
        Couldn&apos;t re-plan. Muse&apos;s options above still stand.{" "}
        <button type="button" className="underline" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  const res = r.result;
  return (
    <div className="border-t border-rule bg-paper px-6 py-6 sm:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-muted">&ldquo;{r.text}&rdquo;</span>
        <button type="button" onClick={onDismiss} className="text-[14px] text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
          Discard
        </button>
      </div>
      <p className="mt-3 text-[19px] font-semibold leading-snug tracking-[-0.015em]">{res.summary}</p>
      {res.tradeoff && <p className="mt-1.5 text-[14px] text-ink-2">{res.tradeoff}</p>}
      <ul className="mt-4">
        {res.options.map((o) => (
          <li key={o.label} className="flex items-start justify-between gap-4 border-t border-rule py-4">
            <div className="min-w-0">
              <div className="text-[15.5px] font-medium leading-snug">{o.label.replace(/\s*(→|->)\s*/g, " to ")}</div>
              <div className="mt-0.5 text-[13.5px] text-muted">{o.why}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {o.label === res.recommended && <Tag tone="pick">Best fit</Tag>}
                {o.new && <Tag tone="tradeoff">New, not confirmed by Muse</Tag>}
                {o.source_url && (
                  <a href={o.source_url} target="_blank" rel="noreferrer" className="text-[12px] text-muted underline underline-offset-2">
                    Source
                  </a>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="num text-[16px] font-semibold">{o.price_cad != null ? money(o.price_cad) : "–"}</span>
              <Btn
                kind="secondary"
                className="!px-3 !py-1.5 !text-[13px]"
                onClick={() =>
                  onPick(
                    { ...o, price_cad: o.price_cad ?? 0 },
                    `${res.instruction_for_agent} (I picked: ${o.label}${o.price_cad != null ? `, about ${money(o.price_cad)}` : ""}. Confirm the real price before booking.)`,
                  )
                }
              >
                Pick
              </Btn>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-muted">
        Live search, {(r.ms / 1000).toFixed(0)}s. Muse re-prices new options before anything is held.
      </p>
    </div>
  );
}
