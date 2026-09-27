"use client";

import { useEffect, useState } from "react";
import type { Brief, DecisionView, OptionView } from "@/lib/derive";
import { clock, minutes, money, until } from "@/lib/format";
import { useLive } from "@/lib/live";
import { useStore, type Replan } from "@/lib/store";
import type { ReplanOption } from "@/app/api/replan/route";
import { AuditTag, Btn, FlagTag, Tag } from "./ui";
import { Recheck } from "./Recheck";

const THREAD_LABEL: Record<string, string> = {
  "nyc-stay": "New York bed · Oct 10–14",
  return: "Return · Sun Oct 18",
  out: "Outbound · Sat Oct 10",
  "nyc-bos": "New York → Boston · Oct 14",
  "bos-stay": "Boston bed · Oct 14–18",
};

function factsLine(o: OptionView) {
  const x = o.facts ?? {};
  const bits: string[] = [];
  if (x.layover_min) bits.push(`${minutes(x.layover_min)} layover`);
  if (x.duration_min && !x.layover_min) bits.push(minutes(x.duration_min));
  if (x.nights) bits.push(`${x.nights} nights`);
  if (x.commute_min) bits.push(`${x.commute_min} min to sights`);
  if (o.note) bits.push(o.note);
  return bits.join(" · ");
}

const REDIRECT_CHIPS: Record<string, string[]> = {
  return: ["Direct only — I'll go a little over budget", "Anything that gets me home by 3 PM", "Find me something cheaper, any mode"],
  "nyc-stay": ["Private room, central, under $500", "Cheapest thing that's under 20 min from Midtown", "Somewhere in Brooklyn"],
};

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

  const choose = (label: string | null, price: number | null, line: string) => {
    dispatch({ t: "decision", id: d.event.id, s: { status: "sending", choice: label, price, at: Date.now() } });
    queue(`decision:${d.event.id}`, line);
    // Optimistic: it's in the reply immediately; the short "sending" beat is
    // just the UI acknowledging the tap before it collapses.
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
            options: d.options.map((o) => ({ label: o.label, price_cad: o.price_cad, refundable: o.refundable, held: o.held, facts: o.facts, note: o.note })),
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
      <div className="border border-rule bg-card px-4 py-3">
        <div className="eyebrow">{THREAD_LABEL[thread] ?? "Decision"}</div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div className="text-[15px] font-medium">
            {st.choice ? (
              <>
                <span className="text-ok">✓</span> {st.choice}
              </>
            ) : (
              <>
                <span className="text-bad">✕</span> None of these
              </>
            )}
          </div>
          {st.price !== null && <div className="num text-[15px] font-medium">{money(st.price)}</div>}
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted">
          <span>{st.status === "sending" ? <span className="working">Adding to your reply…</span> : "In your reply to Muse · not sent yet"}</span>
          <button type="button" onClick={reopen} className="underline underline-offset-2 hover:text-ink">
            Change
          </button>
        </div>
      </div>
    );
  }

  const suggestions = REDIRECT_CHIPS[thread] ?? ["Find something cheaper", "Prioritize comfort over price"];

  return (
    <article className="border border-rule-strong bg-card">
      <header className="flex items-center justify-between border-b border-rule px-4 py-2">
        <span className="eyebrow !text-act">{THREAD_LABEL[thread] ?? "Decision"}</span>
        {d.expires_at && (
          <span className="num text-[12px] text-act">Hold ends in {until(d.expires_at, now)}</span>
        )}
      </header>

      <div className="px-4 pt-3">
        <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">{d.event.title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{d.event.detail}</p>
        <p className="mt-1 text-[12px] text-muted">
          Muse, {clock(d.event.ts)}
          {d.related.length > 0 && ` · updated ${clock(d.related[d.related.length - 1].ts)}`}
        </p>
      </div>

      <fieldset className="mt-3">
        <legend className="sr-only">Options</legend>
        {d.options.map((o) => {
          const delta = o.price_cad - recPrice;
          const total = live.totalIf(d.event.id, o.price_cad);
          const over = total - live.budget;
          const picked = sel === o.label;
          return (
            <label
              key={o.label}
              className={`block cursor-pointer border-t border-rule px-4 py-3 ${picked ? "bg-paper" : ""}`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name={d.event.id}
                  checked={picked}
                  onChange={() => setSel(o.label)}
                  className="mt-1 size-4 shrink-0 accent-[var(--ink)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[15px] font-medium leading-snug">{o.label}</div>
                      {factsLine(o) && <div className="mt-0.5 text-[12.5px] text-muted">{factsLine(o)}</div>}
                    </div>
                    <div className="num shrink-0 text-right">
                      <div className="text-[15px] font-semibold">{money(o.price_cad)}</div>
                      {o.label !== d.recommended && (
                        <div className={`mt-0.5 text-[12.5px] ${delta > 0 ? "text-ink-2" : "text-ok"}`}>{money(delta, { sign: true })}</div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {o.label === d.recommended && <Tag tone="ink">Muse&apos;s pick</Tag>}
                    {o.held && <Tag tone="ok">On hold</Tag>}
                    {o.audit && <AuditTag status={o.audit.status} onClick={() => onAudit(d.event.id)} />}
                    {o.flags.filter((f) => !f.text.startsWith("Auditor") && !f.text.startsWith("Couldn")).map((f) => (
                      <FlagTag key={f.text} f={f} />
                    ))}
                  </div>
                  {o.audit && o.audit.status !== "verified" && (
                    <p className="mt-1.5 text-[12.5px] leading-snug text-bad">{o.audit.note}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[12px] text-muted">
                    <span className={over > 0 ? "text-bad" : ""}>
                      Trip total <span className="num">{money(total)}</span>
                      {over > 0 ? ` · ${money(over)} over` : ` · ${money(-over)} left`}
                    </span>
                    {o.checked_at && <Recheck o={o} when={THREAD_LABEL[thread] ?? ""} checkedAt={o.checked_at} />}
                  </div>
                </div>
              </div>
            </label>
          );
        })}
      </fieldset>

      {replan && <ReplanPanel r={replan} onPick={(o, instr) => choose(o.label, o.price_cad, instr)} onDismiss={() => dispatch({ t: "replan", id: d.event.id, r: null })} />}

      {redirecting && (
        <div className="border-t border-rule px-4 py-3">
          <label htmlFor={`r-${d.event.id}`} className="text-[13px] font-medium">
            Tell Muse what you want instead
          </label>
          <textarea
            id={`r-${d.event.id}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            autoFocus
            className="mt-1.5 w-full resize-none border border-rule bg-paper px-3 py-2 text-[15px] outline-none focus:border-ink"
            placeholder="e.g. direct only, I'll go a bit over"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((c) => (
              <button key={c} type="button" onClick={() => setText(c)} className="border border-rule px-2 py-1 text-[12.5px] text-ink-2 hover:border-ink">
                {c}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Btn kind="primary" onClick={() => sendRedirect(text)} disabled={!text.trim()}>
              Re-plan
            </Btn>
            <Btn kind="ghost" onClick={() => setRedirecting(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {!redirecting && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-3">
          <Btn
            kind="act"
            onClick={() => {
              const o = d.options.find((x) => x.label === sel)!;
              choose(o.label, o.price_cad, `${THREAD_LABEL[thread] ?? d.event.title}: go with ${o.label} (${money(o.price_cad)}).${o.held ? " Use the hold." : ""}`);
            }}
          >
            Book {sel === d.recommended ? "Muse's pick" : "this one"}
          </Btn>
          <Btn kind="secondary" onClick={() => setRedirecting(true)} disabled={replan?.status === "thinking"}>
            Redirect
          </Btn>
          <Btn
            kind="ghost"
            className="ml-auto"
            onClick={() => choose(null, 0, `${THREAD_LABEL[thread] ?? d.event.title}: none of these. Release any hold and don't book yet.`)}
          >
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
  [7000, "Checking against your budget"],
  [14000, "Still going. Free-tier search is slow; you can keep working, this card will update"],
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
      <div className="border-t border-rule bg-paper px-4 py-3">
        <div className="text-[12px] text-muted">You said: &ldquo;{r.text}&rdquo;</div>
        <div className="mt-2 flex items-center gap-2 text-[14px]">
          <span className="working inline-block size-2 bg-act" aria-hidden />
          <span>{stage}…</span>
          <span className="num ml-auto text-[12px] text-muted">{Math.floor(el / 1000)}s</span>
        </div>
      </div>
    );
  }

  if (r.status === "error") {
    return (
      <div className="border-t border-rule bg-bad-bg px-4 py-3 text-[13px] text-bad">
        Couldn&apos;t re-plan (&ldquo;{r.error}&rdquo;). Muse&apos;s original options above still stand.{" "}
        <button type="button" className="underline" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    );
  }

  const res = r.result;
  return (
    <div className="border-t-2 border-ink bg-paper px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Re-plan · &ldquo;{r.text}&rdquo;</span>
        <button type="button" onClick={onDismiss} className="text-[12px] text-muted underline underline-offset-2">
          Discard
        </button>
      </div>
      <p className="mt-1.5 text-[14px] leading-relaxed">{res.summary}</p>
      {res.tradeoff && <p className="mt-1 text-[13px] text-ink-2">Trade-off: {res.tradeoff}</p>}
      <ul className="mt-2">
        {res.options.map((o) => (
          <li key={o.label} className="flex items-start justify-between gap-3 border-t border-rule py-2.5">
            <div className="min-w-0">
              <div className="text-[14.5px] font-medium leading-snug">
                {o.label}
                {o.label === res.recommended && <span className="ml-1.5 align-middle"><Tag tone="ink">Best fit</Tag></span>}
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted">{o.why}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {o.new ? <Tag tone="warn">New · Muse hasn&apos;t confirmed</Tag> : <Tag>From Muse&apos;s list</Tag>}
                {o.source_url && (
                  <a href={o.source_url} target="_blank" rel="noreferrer" className="text-[11px] text-muted underline underline-offset-2">
                    source
                  </a>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="num text-[15px] font-semibold">{o.price_cad != null ? money(o.price_cad) : "—"}</span>
              <Btn
                kind="secondary"
                className="!px-2.5 !py-1 !text-[12.5px]"
                onClick={() => onPick({ ...o, price_cad: o.price_cad ?? 0 }, `${res.instruction_for_agent} (I picked: ${o.label}${o.price_cad != null ? `, ~${money(o.price_cad)}` : ""}. Confirm the real price before booking.)`)}
              >
                Pick
              </Btn>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[11.5px] text-muted">
        {res.model} with live search · {(r.ms / 1000).toFixed(1)}s. New options are a lead, not a booking: Muse re-prices them before anything is held.
      </p>
    </div>
  );
}
