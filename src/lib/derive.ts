import { toCad, money, minutes, clock } from "./format";
import type { Audit, AuditClaim, LogEvent, Option, Run } from "./types";

export interface PricePoint {
  price_cad: number;
  at: string;
}

export interface Flag {
  level: "bad" | "warn" | "info";
  text: string;
}

export interface OptionView extends Option {
  price_cad: number;
  history: PricePoint[];
  flags: Flag[];
  audit?: AuditClaim;
  added_by: string; // event id that first introduced it
}

export interface DecisionView {
  event: LogEvent;
  options: OptionView[];
  recommended: string | null;
  expires_at: string | null;
  related: LogEvent[];
}

export interface ActionView {
  event: LogEvent;
  option: OptionView;
  alternatives: OptionView[];
  corrections: LogEvent[];
  rule: { refundable: boolean; cancelsAfterWake: boolean; withinPreauth: boolean };
}

export interface Brief {
  run: Run;
  decisions: DecisionView[];
  actions: ActionView[];
  assumptions: LogEvent[];
  mistakes: LogEvent[];
  lapsed: LogEvent[];
  updates: LogEvent[];
  searches: LogEvent[];
  timeline: LogEvent[];
  audit: Audit;
  spend: {
    budget: number;
    preauth: number;
    reserved: number;
    held: number;
    pending: number; // recommended picks on open decisions
    preauthBreached: boolean;
  };
  checkFirst: { level: Flag["level"]; text: string; event_id: string }[];
}

const baseLabel = (l: string) => l.replace(/\s*\((?:with taxes|expired)\)\s*$/i, "").trim();

const ampm = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function optionFlags(o: OptionView): Flag[] {
  const f: Flag[] = [];
  const x = o.facts ?? {};
  if (x.depart && x.depart < "07:00") f.push({ level: "warn", text: `${ampm(x.depart)} departure` });
  if (x.layover_min && x.layover_min >= 240) f.push({ level: "warn", text: `${minutes(x.layover_min)} layover` });
  if (x.duration_min && x.duration_min >= 600) f.push({ level: "warn", text: `${minutes(x.duration_min)} trip` });
  if (x.commute_min && x.commute_min >= 35) f.push({ level: "warn", text: `${x.commute_min} min from the sights` });
  if (o.refundable === false) f.push({ level: "info", text: "Non-refundable" });
  if (x.window_seat === false) f.push({ level: "info", text: "No window seat" });
  if (!o.source_url) f.push({ level: "bad", text: "No source link" });
  if (o.history.length > 1) {
    const first = o.history[0];
    const d = o.price_cad - first.price_cad;
    if (d !== 0) f.push({ level: d > 0 ? "warn" : "info", text: `${money(d, { sign: true })} since ${clock(first.at)}` });
  }
  if (o.audit?.status === "conflict") f.push({ level: "bad", text: "Auditor disagrees" });
  if (o.audit?.status === "unsourced") f.push({ level: "bad", text: "Couldn't verify" });
  return f;
}

export function derive(run: Run, log: LogEvent[], audit: Audit): Brief {
  const events = [...log].sort((a, b) => a.ts.localeCompare(b.ts));
  const wakeAt = new Date(run.wake_at).getTime();

  const findAudit = (eventIds: string[], label: string) =>
    audit.claims.find(
      (c) => eventIds.includes(c.event_id) && c.option_label && baseLabel(c.option_label) === baseLabel(label),
    );

  // Merge an event's options with everything that later corrects/updates it.
  function mergedOptions(root: LogEvent): { opts: OptionView[]; related: LogEvent[] } {
    const related = events.filter((e) => e.corrects === root.id || e.updates === root.id);
    const map = new Map<string, OptionView>();
    for (const ev of [root, ...related]) {
      for (const o of ev.options ?? []) {
        const key = baseLabel(o.label);
        const price_cad = o.price_cad ?? toCad(o.price, o.currency);
        const point = { price_cad, at: o.checked_at ?? ev.ts };
        const prev = map.get(key);
        if (prev) {
          map.set(key, { ...prev, ...o, label: prev.label, held: prev.held || o.held, price_cad, history: [...prev.history, point] });
        } else {
          map.set(key, { ...o, label: key, price_cad, history: [point], flags: [], added_by: ev.id });
        }
      }
    }
    const ids = [root.id, ...related.map((r) => r.id)];
    const opts = [...map.values()].map((o) => {
      const withAudit = { ...o, audit: findAudit(ids, o.label) };
      return { ...withAudit, flags: optionFlags(withAudit) };
    });
    return { opts, related };
  }

  const decisions: DecisionView[] = events
    .filter((e) => e.kind === "decision")
    .map((e) => {
      const { opts, related } = mergedOptions(e);
      return { event: e, options: opts, recommended: e.recommended ? baseLabel(e.recommended) : null, expires_at: e.expires_at ?? null, related };
    });

  const preauth = run.preauth_cad;
  let running = 0;
  const actions: ActionView[] = events
    .filter((e) => e.kind === "would_book")
    .map((e) => {
      const { opts, related } = mergedOptions(e);
      const pick = baseLabel(e.recommended ?? opts[0].label);
      const option = opts.find((o) => o.label === pick) ?? opts[0];
      running += option.price_cad;
      return {
        event: e,
        option,
        alternatives: opts.filter((o) => o !== option),
        corrections: related,
        rule: {
          refundable: option.refundable !== false,
          cancelsAfterWake: !!option.cancel_by && new Date(option.cancel_by).getTime() > wakeAt,
          withinPreauth: running <= preauth,
        },
      };
    });

  const reserved = actions.reduce((s, a) => s + a.option.price_cad, 0);
  const held = decisions.reduce((s, d) => s + d.options.filter((o) => o.held).reduce((t, o) => t + o.price_cad, 0), 0);
  const pending = decisions.reduce((s, d) => s + (d.options.find((o) => o.label === d.recommended)?.price_cad ?? 0), 0);

  const mistakes = events.filter((e) => e.kind === "mistake");
  const lapsed = events.filter((e) => e.lost_savings_cad);

  const checkFirst: Brief["checkFirst"] = [];
  if (reserved > preauth) {
    const breach = actions.find((a) => !a.rule.withinPreauth);
    checkFirst.push({
      level: "bad",
      text: `Muse reserved ${money(reserved)} overnight, ${money(reserved - preauth)} past your ${money(preauth)} limit`,
      event_id: breach?.corrections[0]?.id ?? breach?.event.id ?? "",
    });
  }
  for (const c of audit.claims) {
    if (c.status === "conflict" || c.status === "unsourced")
      checkFirst.push({ level: "bad", text: `${c.claim}: ${c.note}`, event_id: c.event_id });
  }
  for (const m of mistakes) {
    if (!checkFirst.some((c) => c.event_id === m.id)) checkFirst.push({ level: "warn", text: m.title, event_id: m.id });
  }
  for (const l of lapsed) checkFirst.push({ level: "info", text: `${l.title} (cost of waiting ${money(l.lost_savings_cad!)})`, event_id: l.id });

  return {
    run,
    decisions,
    actions,
    assumptions: events.filter((e) => e.kind === "assumption"),
    mistakes,
    lapsed,
    updates: events.filter((e) => e.kind === "update" && !e.lost_savings_cad),
    searches: events.filter((e) => e.kind === "search"),
    timeline: events,
    audit,
    spend: { budget: run.budget_cad, preauth, reserved, held, pending, preauthBreached: reserved > preauth },
    checkFirst,
  };
}
