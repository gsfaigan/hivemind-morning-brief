"use client";

import type { Brief, DecisionView } from "./derive";
import { useStore } from "./store";

// Spend as it stands after whatever the user has done this morning.
export function useLive(brief: Brief) {
  const { s } = useStore();

  const reserved = brief.actions
    .filter((a) => s.undone[a.event.id] !== "undone")
    .reduce((t, a) => t + a.option.price_cad, 0);

  // An option an agent already reserved is counted once, under "Reserved".
  const held = new Set(brief.actions.filter((a) => s.undone[a.event.id] !== "undone").map((a) => a.option.key));
  const costOf = (d: DecisionView, label: string | null, price: number | null) => {
    const o = d.options.find((x) => x.label === label);
    return o && held.has(o.key) ? 0 : (price ?? 0);
  };
  const decisionCost = (d: DecisionView) => {
    const st = s.decisions[d.event.id];
    if (st && st.status !== "open") return costOf(d, st.choice, st.price);
    const rec = d.options.find((o) => o.label === d.recommended);
    return costOf(d, d.recommended, rec?.price_cad ?? 0);
  };

  const decided = brief.decisions.filter((d) => (s.decisions[d.event.id]?.status ?? "open") !== "open");
  const open = brief.decisions.filter((d) => (s.decisions[d.event.id]?.status ?? "open") === "open");

  const chosen = decided.reduce((t, d) => t + decisionCost(d), 0);
  const pending = open.reduce((t, d) => t + decisionCost(d), 0);
  const onHold = open.reduce((t, d) => t + d.options.filter((o) => o.held).reduce((x, o) => x + o.price_cad, 0), 0);
  const projected = reserved + chosen + pending;

  // Trip total if `price` were picked for decision `id`, everything else as-is.
  const totalIf = (id: string, price: number, label?: string) => {
    const d = brief.decisions.find((x) => x.event.id === id)!;
    return projected - decisionCost(d) + (label ? costOf(d, label, price) : price);
  };

  return { reserved, chosen, pending, held: onHold, projected, open, decided, totalIf, budget: brief.spend.budget, preauth: brief.spend.preauth };
}
