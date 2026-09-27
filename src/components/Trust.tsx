"use client";

import Link from "next/link";
import { useState } from "react";
import history from "@/data/sim/history.json";
import type { Brief } from "@/lib/derive";
import { day, money } from "@/lib/format";
import { useProposals } from "@/lib/learn";
import { useStore } from "@/lib/store";
import { Outbox } from "./Outbox";
import { Btn, Nav, Page, Section, Tag } from "./ui";

export function Trust({ brief }: { brief: Brief }) {
  const { s, dispatch, queue } = useStore();
  const proposals = useProposals(brief);
  const [hover, setHover] = useState<number | null>(null);
  const trips = history.trips;
  const maxQ = Math.max(...trips.map((t) => t.asked + t.auto));
  const kept = brief.actions.filter((a) => a.rule.refundable && a.rule.cancelsAfterWake && a.rule.withinPreauth).length;

  const decide = (id: string, rule: string, v: "accepted" | "declined") => {
    dispatch({ t: "rule", id, v });
    queue(`rule:${id}`, v === "accepted" ? `New standing rule for future trips: ${rule}` : null);
  };

  return (
    <Page>
      <Nav here="trust" date={day(brief.run.wake_at)} />

      <header className="mt-12 sm:mt-16">
        <h1 className="text-[36px] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[44px]">The line is reversibility.</h1>
        <p className="mt-4 text-[18px] leading-snug text-ink-2 sm:text-[19px]">Muse acts alone only when you could undo it for free after you wake up.</p>
      </header>

      <Section label="Tonight's rules">
        <dl className="border-t border-rule">
          <Rule k="Alone" tone="ok" v={`Refundable bookings that stay cancellable past 8 AM, up to ${money(brief.spend.preauth)}. Holds. Seats.`} />
          <Rule k="Waits" tone="act" v={`Anything non-refundable, over ${money(brief.spend.preauth)}, or outside what you asked for.`} />
          <Rule k="Never" tone="problem" v="Wakes you up." />
        </dl>
        <p className="mt-5 text-[14px] text-muted">
          Last night: inside the rules {kept} of {brief.actions.length} times. One miss, which it reported itself.
        </p>
      </Section>

      <Section label="Learned this morning" count={proposals.length}>
        {proposals.length === 0 ? (
          <p className="border-t border-rule pt-5 text-[15px] leading-relaxed text-muted">
            Go against a pick on the{" "}
            <Link href="/" className="underline decoration-rule underline-offset-4 hover:text-ink">
              brief
            </Link>{" "}
            and a rule shows up here. Nothing sticks until you accept it.
          </p>
        ) : (
          <ul className="border-t border-rule">
            {proposals.map((p) => {
              const v = s.rules[p.id];
              return (
                <li key={p.id} className="border-b border-rule py-6">
                  <p className="text-[17px] font-medium leading-snug">{p.rule}</p>
                  <p className="mt-1.5 text-[13.5px] text-muted">{p.because}</p>
                  <div className="mt-4 flex items-center gap-3">
                    {v === "accepted" ? (
                      <>
                        <Tag tone="ok">Rule, in your reply</Tag>
                        <button type="button" className="text-[13px] text-muted underline decoration-rule underline-offset-4" onClick={() => decide(p.id, p.rule, "declined")}>
                          Undo
                        </button>
                      </>
                    ) : v === "declined" ? (
                      <>
                        <Tag>Just this once</Tag>
                        <button type="button" className="text-[13px] text-muted underline decoration-rule underline-offset-4" onClick={() => decide(p.id, p.rule, "accepted")}>
                          Make it a rule
                        </button>
                      </>
                    ) : (
                      <>
                        <Btn kind="primary" className="!px-3.5 !py-1.5 !text-[13.5px]" onClick={() => decide(p.id, p.rule, "accepted")}>
                          Make it a rule
                        </Btn>
                        <Btn kind="ghost" className="!text-[13.5px]" onClick={() => decide(p.id, p.rule, "declined")}>
                          Just this once
                        </Btn>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section label="Trip 1 vs. trip 10" aside={<Tag tone="tradeoff">Simulated</Tag>}>
        <p className="text-[16px] leading-relaxed text-ink-2">
          Trust is earned per category and lost faster than it&apos;s gained. Irreversible spending never becomes automatic.
        </p>

        <figure className="mt-10">
          <figcaption className="text-[13.5px] font-medium">Decisions Muse brought to you</figcaption>
          <div className="relative mt-6 flex h-40 items-end gap-[2px] border-b border-rule-strong" onMouseLeave={() => setHover(null)}>
            {trips.map((t, i) => {
              const total = t.asked + t.auto;
              return (
                <div
                  key={t.n}
                  className="relative flex h-full flex-1 flex-col justify-end outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  aria-label={`Trip ${t.n}: asked ${t.asked} of ${total}`}
                >
                  <div className="border border-b-0 border-rule" style={{ height: `${(t.auto / maxQ) * 100}%` }} />
                  <div className={t.event ? "bg-act" : "bg-ink"} style={{ height: `${(t.asked / maxQ) * 100}%` }} />
                </div>
              );
            })}
            {hover !== null && (
              <div
                className="pointer-events-none absolute bottom-full z-10 mb-3 w-56 -translate-x-1/2 border border-rule-strong bg-paper px-3 py-2.5 text-[12.5px] leading-snug"
                style={{ left: `${Math.min(78, Math.max(22, ((hover + 0.5) / trips.length) * 100))}%` }}
              >
                <div className="font-medium">{trips[hover].name}</div>
                <div className="num mt-1 text-ink-2">
                  Asked {trips[hover].asked} of {trips[hover].asked + trips[hover].auto} · limit {money(trips[hover].preauth)}
                </div>
                {trips[hover].event && <div className="mt-1.5 text-act">{trips[hover].event}</div>}
              </div>
            )}
          </div>
          <div className="num mt-2 flex text-[11.5px] text-muted">
            {trips.map((t) => (
              <span key={t.n} className="flex-1 text-center">
                {t.n}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
            <span className="flex items-center gap-2"><span className="inline-block size-2.5 bg-ink" /> Asked you</span>
            <span className="flex items-center gap-2"><span className="inline-block size-2.5 border border-rule" /> Handled alone</span>
            <span className="flex items-center gap-2"><span className="inline-block size-2.5 bg-act" /> Trust reset</span>
          </div>
          <p className="mt-6 border-l-2 border-act pl-4 text-[14px] leading-relaxed text-ink-2">Trip 6: {trips[5].event}</p>
        </figure>

        <div className="mt-14 border-t border-rule">
          {history.categories.map((c) => (
            <div key={c.name} className="grid gap-x-6 gap-y-1 border-b border-rule py-5 sm:grid-cols-[140px_1fr]">
              <div className="text-[15px] font-medium">{c.name}</div>
              <div>
                <div className="text-[15px]">{c.trip10}</div>
                <div className="mt-1 text-[13px] text-muted">{c.evidence}</div>
              </div>
            </div>
          ))}
        </div>

        <h3 className="eyebrow mt-14">Rules it picked up</h3>
        <ol className="mt-4 border-t border-rule">
          {history.learned.map((r) => (
            <li key={r.rule} className="flex gap-5 border-b border-rule py-4 text-[15px]">
              <span className="num w-14 shrink-0 text-muted">Trip {r.trip}</span>
              <span>{r.rule}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[12.5px] text-muted">Only trip 1 is real. Trips 2 to 10 are simulated.</p>
      </Section>

      <Outbox brief={brief} />
    </Page>
  );
}

function Rule({ k, v, tone }: { k: string; v: string; tone: "ok" | "act" | "problem" }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-4 border-b border-rule py-5">
      <dt>
        <Tag tone={tone}>{k}</Tag>
      </dt>
      <dd className="text-[15.5px] leading-relaxed">{v}</dd>
    </div>
  );
}
