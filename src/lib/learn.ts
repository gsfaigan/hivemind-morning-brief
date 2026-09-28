"use client";

import type { Brief } from "./derive";
import { ampm, money, minutes } from "./format";
import { useStore } from "./store";

export interface Proposal {
  id: string;
  because: string;
  rule: string;
}

// Turns what the user did this morning into standing rules the agents could follow
// next time. Nothing becomes a rule until the user accepts it.
export function useProposals(brief: Brief): Proposal[] {
  const { s } = useStore();
  const out: Proposal[] = [];

  for (const d of brief.decisions) {
    const st = s.decisions[d.event.id];
    if (!st || st.status === "open" || !st.choice || st.choice === d.recommended) continue;
    const rec = d.options.find((o) => o.label === d.recommended);
    const pick = d.options.find((o) => o.label === st.choice);
    const delta = (st.price ?? 0) - (rec?.price_cad ?? 0);
    const cap = Math.ceil((delta + 40) / 50) * 50;
    if (rec?.facts?.layover_min && rec.facts.layover_min >= 240 && !pick?.facts?.layover_min) {
      out.push({
        id: `layover:${d.event.id}`,
        because: `You paid ${money(delta, { sign: true })} to skip a ${minutes(rec.facts.layover_min)} layover.`,
        rule: `Treat layovers over 4h as a dealbreaker when the fix costs under ${money(cap)}.`,
      });
    } else if (/dorm/i.test(rec?.label ?? "") && /private/i.test(st.choice)) {
      const nights = rec?.facts?.nights ?? 4;
      out.push({
        id: `private:${d.event.id}`,
        because: `You picked a private room over a dorm for ${money(delta, { sign: true })}.`,
        rule: `Default to a private room when it's under ${money(Math.ceil(delta / nights / 5) * 5 + 5)}/night more.`,
      });
    } else if (rec?.facts?.commute_min && pick?.facts?.commute_min && pick.facts.commute_min > rec.facts.commute_min) {
      out.push({
        id: `commute:${d.event.id}`,
        because: `You took the farther place to save ${money(-delta)}.`,
        rule: `Up to ${pick.facts.commute_min} min from the sights is fine if it saves real money.`,
      });
    } else {
      out.push({
        id: `pref:${d.event.id}`,
        because: `You chose ${st.choice} over the agent's pick.`,
        rule: `Next time, lean toward ${st.choice}.`,
      });
    }
  }

  for (const a of brief.actions) {
    if (s.undone[a.event.id] !== "undone") continue;
    const dep = a.option.facts?.depart;
    if (dep && dep < "07:00") {
      out.push({
        id: `early:${a.event.id}`,
        because: `You cancelled the ${ampm(dep)} flight picked to save money.`,
        rule: "No departures before 7 AM unless it saves $100+.",
      });
    } else {
      out.push({
        id: `ask:${a.event.id}`,
        because: `You undid ${a.option.label}.`,
        rule: `Ask before reserving ${a.event.thread?.includes("stay") ? "beds" : "this kind of leg"}.`,
      });
    }
  }

  for (const e of brief.assumptions) {
    const c = s.assumptions[e.id]?.choice;
    if (c) out.push({ id: `assume:${e.id}`, because: e.agree ? `You corrected "${e.headline}".` : `You settled "${e.headline}".`, rule: `Next time, assume ${c}.` });
  }

  return out;
}
