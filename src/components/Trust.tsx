"use client";

import Link from "next/link";
import { useState } from "react";
import history from "@/data/sim/history.json";
import type { Brief } from "@/lib/derive";
import { day, money } from "@/lib/format";
import { useProposals } from "@/lib/learn";
import { useStore } from "@/lib/store";
import { Outbox } from "./Outbox";
import { Btn, Section, Tag } from "./ui";

export function Trust({ brief }: { brief: Brief }) {
  const { s, dispatch, queue } = useStore();
  const proposals = useProposals(brief);
  const [hover, setHover] = useState<number | null>(null);
  const kept = brief.actions.filter((a) => a.rule.refundable && a.rule.cancelsAfterWake && a.rule.withinPreauth).length;
  const trips = history.trips;
  const maxQ = Math.max(...trips.map((t) => t.asked + t.auto));

  const decide = (id: string, rule: string, v: "accepted" | "declined") => {
    dispatch({ t: "rule", id, v });
    queue(`rule:${id}`, v === "accepted" ? `New standing rule for future trips: ${rule}` : null);
  };

  return (
    <div className="mx-auto max-w-[460px] px-4 pb-40 pt-6">
      <nav className="flex items-center justify-between text-[13px]">
        <span className="eyebrow">{day(brief.run.wake_at)}</span>
        <div className="flex gap-4 text-muted">
          <Link href="/" className="hover:text-ink">Brief</Link>
          <Link href="/night" className="hover:text-ink">Night log</Link>
          <span className="text-ink">Trust</span>
        </div>
      </nav>

      <h1 className="mt-6 text-[28px] font-semibold leading-tight tracking-[-0.02em]">What Muse may do without you</h1>
      <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">
        The line is reversibility, not price. Muse acts alone only when you could undo it after waking up, for free. Everything else waits for you.
      </p>

      <Section label="Tonight's rules" aside="trip 1">
        <dl className="border-t border-rule text-[14px]">
          <Rule k="Alone" tone="ok" v={`Reserve anything refundable whose free-cancel window lasts past 8 AM, up to ${money(brief.spend.preauth)} total. Put free holds on fares. Pick seats. Search.`} />
          <Rule k="Waits" tone="act" v={`Anything non-refundable. Anything that takes the night past ${money(brief.spend.preauth)}. Anything that bends what you asked for (dates, cities, the $1,500). Taste calls where the options are close.`} />
          <Rule k="Never" tone="bad" v="Wake you up. Enter a card for something that can't be undone." />
        </dl>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
          Last night Muse stayed inside these {kept} of {brief.actions.length} times. It went {money(brief.spend.reserved - brief.spend.preauth)} past the limit once, because it missed Boston hotel tax, and told you itself at 4:10 AM. It let one fare expire rather than break a rule, and logged what that cost.
        </p>
      </Section>

      <Section label="Learned from this morning" count={proposals.length}>
        {proposals.length === 0 ? (
          <p className="border-t border-rule pt-3 text-[13.5px] leading-relaxed text-muted">
            Nothing yet. When you go against one of Muse&apos;s picks on the{" "}
            <Link href="/" className="underline underline-offset-2">brief</Link>, undo something, or correct an assumption, it proposes a rule here. Nothing becomes a rule until you accept it.
          </p>
        ) : (
          <ul className="border-t border-rule">
            {proposals.map((p) => {
              const v = s.rules[p.id];
              return (
                <li key={p.id} className="border-b border-rule py-3">
                  <p className="text-[12.5px] text-muted">{p.because}</p>
                  <p className="mt-0.5 text-[14.5px] font-medium leading-snug">{p.rule}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {v === "accepted" ? (
                      <>
                        <Tag tone="ok">Rule · in your reply to Muse</Tag>
                        <button type="button" className="text-[12px] text-muted underline" onClick={() => decide(p.id, p.rule, "declined")}>undo</button>
                      </>
                    ) : v === "declined" ? (
                      <>
                        <Tag>Not a rule. Muse will ask again</Tag>
                        <button type="button" className="text-[12px] text-muted underline" onClick={() => decide(p.id, p.rule, "accepted")}>make it one</button>
                      </>
                    ) : (
                      <>
                        <Btn kind="primary" className="!px-2.5 !py-1 !text-[12.5px]" onClick={() => decide(p.id, p.rule, "accepted")}>Make it a rule</Btn>
                        <Btn kind="ghost" className="!text-[12.5px]" onClick={() => decide(p.id, p.rule, "declined")}>Just this once</Btn>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section label="Trip 1 → trip 10" aside={<Tag tone="warn">Simulated after trip 1</Tag>}>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          Autonomy is earned per category, from how often you&apos;d have made the same call. It&apos;s lost faster than it&apos;s gained, and irreversible spending never becomes automatic.
        </p>

        <figure className="mt-5">
          <figcaption className="flex items-baseline justify-between text-[12.5px]">
            <span className="font-medium">Decisions Muse brought to you, per trip</span>
            <span className="text-muted">of all it made</span>
          </figcaption>
          <div className="relative mt-3 flex h-36 items-end gap-[2px] border-b border-rule-strong" onMouseLeave={() => setHover(null)}>
            {trips.map((t, i) => {
              const total = t.asked + t.auto;
              return (
                <div
                  key={t.n}
                  className="relative flex h-full flex-1 flex-col justify-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                  aria-label={`Trip ${t.n}: asked ${t.asked} of ${total}`}
                >
                  <div className="border border-b-0 border-rule" style={{ height: `${(t.auto / maxQ) * 100}%` }} />
                  <div className={t.event ? "bg-act" : "bg-ink"} style={{ height: `${(t.asked / maxQ) * 100}%` }} />
                  {t.event && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 text-[10px] text-act">▼</span>}
                </div>
              );
            })}
            {hover !== null && (
              <div
                className="pointer-events-none absolute bottom-full z-10 mb-2 w-52 -translate-x-1/2 border border-rule-strong bg-paper px-2.5 py-2 text-[12px] leading-snug"
                style={{ left: `${Math.min(80, Math.max(20, ((hover + 0.5) / trips.length) * 100))}%` }}
              >
                <div className="font-medium">Trip {trips[hover].n} · {trips[hover].name}</div>
                <div className="num mt-0.5 text-ink-2">
                  Asked you {trips[hover].asked} of {trips[hover].asked + trips[hover].auto} · limit {money(trips[hover].preauth)}
                </div>
                {trips[hover].event && <div className="mt-1 text-act">{trips[hover].event}</div>}
              </div>
            )}
          </div>
          <div className="num mt-1 flex text-[10.5px] text-muted">
            {trips.map((t) => (
              <span key={t.n} className="flex-1 text-center">{t.n}</span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="inline-block size-2 bg-ink" /> Asked you</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 border border-rule" /> Handled alone</span>
            <span className="flex items-center gap-1"><span className="inline-block size-2 bg-act" /> Trust reset</span>
          </div>
          <p className="mt-3 border-l-2 border-act pl-3 text-[12.5px] leading-relaxed text-ink-2">
            Trip 6: {trips[5].event}
          </p>
        </figure>

        <table className="mt-6 w-full border-t border-rule text-left text-[13px]">
          <thead>
            <tr className="text-[11px] text-muted">
              <th className="py-2 font-medium">Category</th>
              <th className="py-2 font-medium">Trip 1</th>
              <th className="py-2 font-medium">Trip 10</th>
            </tr>
          </thead>
          <tbody>
            {history.categories.map((c) => (
              <tr key={c.name} className="border-t border-rule align-top">
                <td className="py-2.5 pr-2 font-medium">{c.name}</td>
                <td className="py-2.5 pr-2 text-ink-2">{c.trip1}</td>
                <td className="py-2.5">
                  <div>{c.trip10}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted">{c.evidence}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="eyebrow mt-6">Rules it learned along the way</h3>
        <ol className="mt-2 border-t border-rule">
          {history.learned.map((r) => (
            <li key={r.rule} className="flex gap-3 border-b border-rule py-2 text-[13.5px]">
              <span className="num w-12 shrink-0 text-muted">Trip {r.trip}</span>
              <span>{r.rule}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11.5px] text-muted">{history.note}</p>
      </Section>

      <Outbox brief={brief} />
    </div>
  );
}

function Rule({ k, v, tone }: { k: string; v: string; tone: "ok" | "act" | "bad" }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-3 border-b border-rule py-2.5">
      <dt><Tag tone={tone}>{k}</Tag></dt>
      <dd className="leading-relaxed text-ink-2">{v}</dd>
    </div>
  );
}
