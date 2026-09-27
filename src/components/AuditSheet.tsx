"use client";

import type { Brief } from "@/lib/derive";
import { clock } from "@/lib/format";
import { AuditTag, Glyph, Sheet } from "./ui";

// The interrogation log: what the auditor asked Muse and the open web about
// each claim, and what came back. This is the "show your work" layer: the
// brief only shows a badge, and this sheet opens when the user taps it.
export function AuditSheet({ brief, eventId, onClose }: { brief: Brief; eventId: string | null; onClose: () => void }) {
  const { audit, timeline } = brief;
  const all = eventId === "all";

  // A decision's claims can live on the events that updated it.
  const ids = new Set<string>();
  if (eventId && !all) {
    ids.add(eventId);
    for (const e of timeline) if (e.updates === eventId || e.corrects === eventId) ids.add(e.id);
    const ev = timeline.find((e) => e.id === eventId);
    if (ev?.updates) ids.add(ev.updates);
    if (ev?.corrects) ids.add(ev.corrects);
  }
  const claims = all ? audit.claims : audit.claims.filter((c) => ids.has(c.event_id));
  const qs = all ? audit.interrogations : audit.interrogations.filter((q) => q.event_id && ids.has(q.event_id));
  const ev = !all && eventId ? timeline.find((e) => e.id === eventId) : null;

  return (
    <Sheet open={!!eventId} onClose={onClose} title={all ? "Fact-check" : "What the auditor found"}>
      <p className="text-[13px] leading-relaxed text-ink-2">
        After Muse finished, an independent auditor ({audit.model}) re-checked its prices against live sources and asked Muse about anything that didn&apos;t add up.
        Ran {clock(audit.generated_at)}.
      </p>

      {ev && (
        <div className="mt-4 border-l-2 border-ink pl-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Glyph kind={ev.kind} /> Muse · {clock(ev.ts)}
          </div>
          <div className="mt-0.5 text-[14px] font-medium leading-snug">{ev.title}</div>
          <p className="mt-0.5 text-[13px] text-ink-2">{ev.detail}</p>
        </div>
      )}

      <h4 className="eyebrow mt-5">Claims</h4>
      {claims.length === 0 && <p className="mt-2 text-[13px] text-muted">Nothing here was fact-checked. Muse reported it itself.</p>}
      <ul className="mt-1">
        {claims.map((c, i) => (
          <li key={i} className="border-b border-rule py-2.5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[13.5px] font-medium leading-snug">{c.option_label ?? c.claim}</span>
              <AuditTag status={c.status} />
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">
              Muse said {c.claim}
              {c.observed && ` · found ${c.observed}`}
            </div>
            <p className="mt-1 text-[13px] text-ink-2">{c.note}</p>
          </li>
        ))}
      </ul>

      {qs.length > 0 && (
        <>
          <h4 className="eyebrow mt-5">Questions asked</h4>
          <ol className="mt-2 space-y-3">
            {qs.map((q) => (
              <li key={q.id} className="text-[13.5px] leading-relaxed">
                <div className="text-[11px] text-muted">
                  Auditor → {q.target === "muse" ? "Muse" : "live web"} · {clock(q.at)}
                </div>
                <p className="mt-0.5 font-medium">{q.q}</p>
                <p className="mt-0.5 border-l border-rule pl-3 text-ink-2">{q.a}</p>
              </li>
            ))}
          </ol>
        </>
      )}
    </Sheet>
  );
}
