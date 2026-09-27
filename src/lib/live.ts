"use client";

import type { Brief, DecisionView } from "./derive";
import { useStore } from "./store";

// Spend as it stands after whatever the user has done this morning.
export function useLive(brief: Brief) {
  const { s } = useStore();

  const reserved = brief.actions
    .filter((a) => s.undone[a.event.id] !== "undone")
    .reduce((t, a) => t + a.option.price_cad, 0);

  const decisionCost = (d: DecisionView) => {
    const st = s.decisions[d.event.id];
    if (st && st.status !== "open") return st.price ?? 0;
    return d.options.find((o) => o.label === d.recommended)?.price_cad ?? 0;
  };

  const decided = brief.decisions.filter((d) => (s.decisions[d.event.id]?.status ?? "open") !== "open");
  const open = brief.decisions.filter((d) => (s.decisions[d.event.id]?.status ?? "open") === "open");

  const chosen = decided.reduce((t, d) => t + decisionCost(d), 0);
  const pending = open.reduce((t, d) => t + decisionCost(d), 0);
  const held = open.reduce((t, d) => t + d.options.filter((o) => o.held).reduce((x, o) => x + o.price_cad, 0), 0);
  const projected = reserved + chosen + pending;

  // Trip total if `price` were picked for decision `id`, everything else as-is.
  const totalIf = (id: string, price: number) =>
    projected - decisionCost(brief.decisions.find((d) => d.event.id === id)!) + price;

  return { reserved, chosen, pending, held, projected, open, decided, totalIf, budget: brief.spend.budget, preauth: brief.spend.preauth };
}
