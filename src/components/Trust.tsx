"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import history from "@/data/sim/history.json";
import { derive } from "@/lib/derive";
import type { RawData } from "@/lib/types";
import { day, money } from "@/lib/format";
import { useProposals } from "@/lib/learn";
import { useStore } from "@/lib/store";
import { Outbox } from "./Outbox";
import { Btn, DarkHeader, Page, Panel, Section, Tag } from "./ui";

export function Trust({ data }: { data: RawData }) {
  const brief = useMemo(() => derive(data.run, data.log, data.audit), [data]);
  const { s, dispatch, queue } = useStore();
  const proposals = useProposals(brief);
  const [hover, setHover] = useState<number | null>(null);
  const trips = history.trips;
  const maxQ = Math.max(...trips.map((t) => t.asked + t.auto));
  const booked = brief.actions.length + brief.decisions.filter((d) => d.clash).reduce((t, d) => t + d.options.length, 0);
  const breaks =
    brief.actions.filter((a) => !(a.rule.refundable && a.rule.cancelsAfterWake && a.rule.withinPreauth)).length +
    brief.decisions.filter((d) => d.clash).reduce((t, d) => t + d.options.filter((o) => o.refundable === false).length, 0);

  const decide = (id: string, rule: string, v: "accepted" | "declined") => {
    dispatch({ t: "rule", id, v });
    queue(`rule:${id}`, v === "accepted" ? `New standing rule for future trips: ${rule}` : null);
  };

  return (
    <>
      <DarkHeader here="trust" date={day(brief.run.wake_at)}>
        <h1 className="rise text-[44px] font-semibold leading-[1] tracking-[-0.04em] sm:text-[72px]">
          The line is
          <br />
          reversibility.
        </h1>
        <p className="rise mt-5 text-[20px] leading-snug text-ink-2 [animation-delay:80ms] sm:text-[24px]">
          Your agents act alone only when you could undo it, for free, after you wake up.
        </p>
      </DarkHeader>
      <Page className="pt-4">

      <Section label="Tonight's rules">
        <dl className="divide-y divide-rule bg-card px-6 sm:px-8">
          <Rule k="Alone" tone="status" v={`Refundable bookings that stay cancellable past 8 AM, up to ${money(brief.spend.preauth)}. Holds. Seats.`} />
          <Rule k="Waits" tone="act" v={`Anything non-refundable, over ${money(brief.spend.preauth)}, or outside what you asked for.`} />
          <Rule k="Never" tone="pick" v="Wakes you up." />
        </dl>
        <p className="mt-5 text-[14px] text-muted">
          Last night: {booked} bookings, {breaks} outside the rules.
        </p>
      </Section>

      <Section label="Learned this morning" count={proposals.length}>
        {proposals.length === 0 ? (
          <p className="bg-card px-6 py-6 text-[15px] leading-relaxed text-muted sm:px-8">
            Go against a pick on the{" "}
            <Link href="/" className="underline decoration-rule underline-offset-4 hover:text-ink">
              brief
            </Link>{" "}
            and a rule shows up here. Nothing sticks until you accept it.
          </p>
        ) : (
          <ul className="divide-y divide-rule bg-card">
            {proposals.map((p) => {
              const v = s.rules[p.id];
              return (
                <li key={p.id} className="px-6 py-6 sm:px-8">
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

        <figure className="mt-10 bg-card p-6 sm:p-8">
          <figcaption className="text-[13.5px] font-medium">Decisions brought to you</figcaption>
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
                  <div className={t.event ? "bg-bad" : "bg-ink"} style={{ height: `${(t.asked / maxQ) * 100}%` }} />
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
                {trips[hover].event && <div className="mt-1.5 text-bad">{trips[hover].event}</div>}
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
            <span className="flex items-center gap-2"><span className="inline-block size-2.5 bg-bad" /> Trust reset</span>
          </div>
          <p className="mt-6 border-l-2 border-bad pl-4 text-[14px] leading-relaxed text-ink-2">Trip 6: {trips[5].event}</p>
        </figure>

        <Panel className="mt-14 divide-y divide-rule">
          {history.categories.map((c) => (
            <div key={c.name} className="grid gap-x-6 gap-y-1 px-6 py-5 sm:grid-cols-[150px_1fr] sm:px-8">
              <div className="text-[15px] font-medium">{c.name}</div>
              <div>
                <div className="text-[15px]">{c.trip10}</div>
                <div className="mt-1 text-[13px] text-muted">{c.evidence}</div>
              </div>
            </div>
          ))}
        </Panel>

        <h3 className="mt-14 text-[20px] font-semibold tracking-[-0.02em]">Rules it picked up</h3>
        <ol className="mt-5 divide-y divide-rule bg-card">
          {history.learned.map((r) => (
            <li key={r.rule} className="flex gap-5 px-6 py-4 text-[15px] sm:px-8">
              <span className="num w-14 shrink-0 text-muted">Trip {r.trip}</span>
              <span>{r.rule}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-[12.5px] text-muted">Only trip 1 is real. Trips 2 to 10 are simulated.</p>
      </Section>

      </Page>
      <Outbox brief={brief} />
    </>
  );
}

function Rule({ k, v, tone }: { k: string; v: string; tone: "status" | "act" | "pick" }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-4 py-5">
      <dt>
        <Tag tone={tone}>{k}</Tag>
      </dt>
      <dd className="text-[15.5px] leading-relaxed">{v}</dd>
    </div>
  );
}
