"use client";

import type { OptionView } from "@/lib/derive";
import { ago, money } from "@/lib/format";
import { useDemoTime, useStore } from "@/lib/store";

// "Checked 4h ago · re-check" — makes the age of every price visible and lets
// the user refresh one on demand instead of trusting a number from 3 AM.
export function Recheck({ o, when, checkedAt }: { o: OptionView; when: string; checkedAt: string }) {
  const { s, dispatch, now } = useStore();
  const toDemo = useDemoTime();
  const key = o.label;
  const r = s.rechecks[key];

  const run = async (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch({ t: "recheck", key, r: { status: "checking", startedAt: Date.now() } });
    try {
      const res = await fetch("/api/recheck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: o.label, price_cad: o.price_cad, source_url: o.source_url, when: `${when}, 2026` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      dispatch({ t: "recheck", key, r: { status: "done", result: json, at: toDemo(Date.now()) } });
    } catch (err) {
      dispatch({ t: "recheck", key, r: { status: "error", error: err instanceof Error ? err.message : "failed" } });
    }
  };

  if (r?.status === "checking") return <span className="working">Re-checking…</span>;

  if (r?.status === "done") {
    const { result } = r;
    const diff = result.observed_price_cad != null ? result.observed_price_cad - o.price_cad : null;
    const cls = result.status === "same" ? "text-ok" : result.status === "changed" ? "text-bad" : "text-warn";
    return (
      <span className={cls} title={result.note}>
        Re-checked {ago(new Date(r.at).toISOString(), now)}:{" "}
        {result.status === "same" && "same price"}
        {result.status === "changed" && diff != null && `now ${money(result.observed_price_cad!)} (${money(diff, { sign: true })})`}
        {result.status === "changed" && diff == null && "price changed"}
        {result.status === "unavailable" && "no longer available"}
        {result.status === "unknown" && "couldn't confirm"}
        <span className="text-muted"> · {result.note}</span>
      </span>
    );
  }

  const stale = now - new Date(checkedAt).getTime() > 3 * 3600e3;
  return (
    <span className={stale ? "text-warn" : ""}>
      Checked {ago(checkedAt, now)} ·{" "}
      <button type="button" onClick={run} className="underline underline-offset-2 hover:text-ink">
        {r?.status === "error" ? "retry" : "re-check"}
      </button>
    </span>
  );
}
