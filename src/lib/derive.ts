import { ampm, clock, minutes, money, toCad } from "./format";
import type { Audit, AuditClaim, LogEvent, Option, Run } from "./types";

// Turns every agent's overnight log into one brief. Where agents overlap
// (same leg, same flight, same question) their entries are merged, and where
// they disagree the disagreement is kept visible rather than resolved silently.

export interface PricePoint {
  price_cad: number;
  at: string;
  agent: string;
}

// Three kinds only: something may be wrong, something you give up, or plain state.
export interface Flag {
  kind: "problem" | "tradeoff" | "status";
  text: string;
}

export interface OptionView extends Option {
  key: string;
  price_cad: number;
  history: PricePoint[];
  quotes: Record<string, number>; // latest price each agent saw
  by: string[]; // agents that found it
  flags: Flag[];
  disagreement?: string; // "Muse $198 · Instinct $211"
  audit?: AuditClaim;
  added_by: string;
}

export interface DecisionView {
  id: string;
  event: LogEvent;
  options: OptionView[];
  recommended: string | null;
  picks: Record<string, string>; // agent -> label it recommends
  expires_at: string | null;
  related: LogEvent[];
  agents: string[];
  // Set when two agents each reserved something different for the same leg.
  clash?: Record<string, string>; // option label -> agent that holds it
}

export interface ActionView {
  event: LogEvent;
  option: OptionView;
  alternatives: OptionView[];
  corrections: LogEvent[];
  by: string[];
  duplicate: boolean; // more than one agent reserved this same thing
  rule: { refundable: boolean; cancelsAfterWake: boolean; withinPreauth: boolean };
}

export interface AssumptionView {
  id: string;
  topic: string;
  thread?: string;
  agree: boolean;
  readings: { agent: string; event: LogEvent }[];
  headline: string;
  summary?: string;
  detail: string;
  choices: string[]; // what the user can pick; agent readings first
  confidence?: LogEvent["confidence"];
}

export interface Brief {
  run: Run;
  agentName: (id: string) => string;
  decisions: DecisionView[];
  actions: ActionView[];
  assumptions: AssumptionView[];
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
    pending: number;
    preauthBreached: boolean;
  };
  // Mistakes and lapsed fares that belong to a leg but aren't a correction of
  // a specific booking. They show on that leg's card, not in a separate list.
  threadNotes: Record<string, LogEvent[]>;
  problemCount: number;
}

const baseLabel = (l: string) => l.replace(/\s*\((?:with taxes|expired)\)\s*$/i, "").trim();
const keyOf = (o: Option) => o.facts?.key ?? baseLabel(o.label).toLowerCase();

const LEG_NOUN: Record<string, string> = {
  out: "flights out",
  "nyc-stay": "beds in New York",
  "nyc-bos": "rides to Boston",
  "bos-stay": "beds in Boston",
  return: "rides home",
};
const TOPIC_NOUN: Record<string, string> = { budget: "the budget", split: "the city split", airports: "the airports" };

function optionFlags(o: OptionView): Flag[] {
  const f: Flag[] = [];
  const x = o.facts ?? {};
  if (o.audit?.status === "conflict") f.push({ kind: "problem", text: "Conflict" });
  else if (o.audit?.status === "unsourced") f.push({ kind: "problem", text: "Unverified" });
  else if (!o.source_url) f.push({ kind: "problem", text: "No source" });
  if (o.audit?.status === "stale") f.push({ kind: "problem", text: "Out of date" });
  if (o.disagreement && o.audit?.status !== "conflict") f.push({ kind: "problem", text: "Agents disagree" });
  if (x.layover_min && x.layover_min >= 240) f.push({ kind: "tradeoff", text: `${minutes(x.layover_min)} layover${x.via ? ` in ${x.via}` : ""}` });
  if (x.depart && x.depart < "07:00") f.push({ kind: "tradeoff", text: `Early start, ${ampm(x.depart)}` });
  if (x.duration_min && x.duration_min >= 600) f.push({ kind: "tradeoff", text: `${minutes(x.duration_min)} on the road` });
  if (x.commute_min && x.commute_min >= 35) f.push({ kind: "tradeoff", text: `${x.commute_min} min from the sights` });
  if (o.refundable === false) f.push({ kind: "tradeoff", text: "Non-refundable" });
  if (x.window_seat === false) f.push({ kind: "tradeoff", text: "No window" });
  // Price movement is only meaningful within one agent's own checks.
  for (const agent of o.by) {
    const pts = o.history.filter((p) => p.agent === agent);
    if (pts.length > 1) {
      const d = pts[pts.length - 1].price_cad - pts[0].price_cad;
      if (d !== 0) f.push({ kind: "tradeoff", text: `${d > 0 ? "Up" : "Down"} ${money(Math.abs(d))} since ${clock(pts[0].at)}` });
    }
  }
  return f;
}

export function derive(runIn: Run, log: LogEvent[], audit: Audit): Brief {
  const events = [...log].sort((a, b) => a.ts.localeCompare(b.ts));
  // An agent that didn't export anything shouldn't show up as an empty lane.
  const active = runIn.agents.filter((a) => events.some((e) => e.agent === a.id));
  const run = { ...runIn, agents: active.length ? active : runIn.agents };
  const wakeAt = new Date(run.wake_at).getTime();
  const names = Object.fromEntries(run.agents.map((a) => [a.id, a.name]));
  const agentName = (id: string) => names[id] ?? id;
  const multi = run.agents.length > 1;

  const findAudit = (eventIds: string[], label: string) =>
    audit.claims.find((c) => eventIds.includes(c.event_id) && c.option_label && baseLabel(c.option_label) === baseLabel(label));

  const relatedTo = (root: LogEvent) => events.filter((e) => e.corrects === root.id || e.updates === root.id);

  // Merge options from a set of events (possibly several agents) by key.
  function merge(sources: LogEvent[]): OptionView[] {
    const map = new Map<string, OptionView>();
    for (const ev of sources) {
      for (const o of ev.options ?? []) {
        const key = keyOf(o);
        const price_cad = o.price_cad ?? toCad(o.price, o.currency);
        const point = { price_cad, at: o.checked_at ?? ev.ts, agent: ev.agent };
        const prev = map.get(key);
        if (prev) {
          const history = [...prev.history, point].sort((a, b) => a.at.localeCompare(b.at));
          map.set(key, {
            ...prev,
            ...o,
            label: prev.label,
            sub: prev.sub ?? o.sub,
            facts: { ...o.facts, ...prev.facts, key },
            held: prev.held || o.held,
            source_url: prev.source_url ?? o.source_url,
            price_cad: history[history.length - 1].price_cad,
            history,
            quotes: { ...prev.quotes, [ev.agent]: price_cad },
            by: prev.by.includes(ev.agent) ? prev.by : [...prev.by, ev.agent],
          });
        } else {
          map.set(key, { ...o, key, label: baseLabel(o.label), price_cad, history: [point], quotes: { [ev.agent]: price_cad }, by: [ev.agent], flags: [], added_by: ev.id });
        }
      }
    }
    const ids = sources.map((s) => s.id);
    return [...map.values()].map((o) => {
      const q = Object.entries(o.quotes);
      const prices = q.map(([, p]) => p);
      const spread = Math.max(...prices) - Math.min(...prices);
      const disagreement =
        q.length > 1 && spread > Math.max(5, Math.min(...prices) * 0.03) ? q.map(([a, p]) => `${agentName(a)} ${money(p)}`).join(" · ") : undefined;
      const withAudit = { ...o, disagreement, audit: findAudit(ids, o.label) };
      return { ...withAudit, flags: optionFlags(withAudit) };
    });
  }

  const byThread = <T extends LogEvent>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const e of list) {
      const t = e.thread ?? e.id;
      m.set(t, [...(m.get(t) ?? []), e]);
    }
    return m;
  };

  // Decisions: one per leg, whichever agents raised it.
  const decisions: DecisionView[] = [];
  for (const [, group] of byThread(events.filter((e) => e.kind === "decision"))) {
    // The latest entry leads: it was written knowing the most (sellouts, price jumps).
    const root = group[group.length - 1];
    const related = group.flatMap((g) => [g, ...relatedTo(g)]).filter((e) => e !== root);
    const options = merge([root, ...related]);
    const picks: Record<string, string> = {};
    for (const g of group) {
      if (!g.recommended) continue;
      const o = options.find((x) => x.label === baseLabel(g.recommended!) || x.key === g.recommended);
      if (o) picks[g.agent] = o.label;
    }
    const expiries = group.map((g) => g.expires_at).filter(Boolean) as string[];
    decisions.push({
      id: root.id,
      event: root,
      options,
      recommended: picks[root.agent] ?? null,
      picks,
      expires_at: expiries.sort()[0] ?? null,
      related,
      agents: [...new Set(group.map((g) => g.agent))],
    });
  }

  // Reservations: one per leg; if agents reserved different things for the
  // same leg, it becomes a decision instead.
  const preauth = run.preauth_cad;
  const actions: ActionView[] = [];
  let running = 0;
  for (const [thread, group] of byThread(events.filter((e) => e.kind === "would_book"))) {
    const perAgent = group.map((ev) => {
      const opts = merge([ev, ...relatedTo(ev)]);
      const pick = ev.recommended ? baseLabel(ev.recommended) : opts[0].label;
      const option = opts.find((o) => o.label === pick) ?? opts[0];
      return { ev, opts, option, corrections: relatedTo(ev) };
    });
    const keys = new Set(perAgent.map((p) => p.option.key));

    if (keys.size > 1) {
      const options = perAgent.map((p) => ({ ...p.option, by: [p.ev.agent] }));
      const keep = options.find((o) => o.refundable !== false) ?? options.slice().sort((a, b) => a.price_cad - b.price_cad)[0];
      const stuck = options.find((o) => o.refundable === false);
      const who = perAgent.map((p) => agentName(p.ev.agent));
      const last = group[group.length - 1];
      decisions.push({
        id: `clash-${thread}`,
        event: {
          id: `clash-${thread}`,
          ts: last.ts,
          kind: "decision",
          thread: last.thread,
          agent: last.agent,
          title: `${who.join(" and ")} both booked ${LEG_NOUN[thread] ?? "this leg"}`,
          headline: `${who.join(" and ")} both booked ${LEG_NOUN[thread] ?? "this leg"}`,
          summary: stuck
            ? `Keep one. ${agentName(perAgent.find((p) => p.option.key === stuck.key)!.ev.agent)}'s ${stuck.label} can't be refunded.`
            : "Keep one. The other is free to cancel.",
          detail: perAgent.map((p) => `${agentName(p.ev.agent)}: ${p.ev.detail}`).join(" "),
        },
        options,
        recommended: keep.label,
        picks: {},
        expires_at: null,
        related: group,
        agents: perAgent.map((p) => p.ev.agent),
        clash: Object.fromEntries(perAgent.map((p) => [p.option.label, p.ev.agent])),
      });
      continue;
    }

    const first = perAgent[0];
    const option = { ...first.option, by: perAgent.map((p) => p.ev.agent) };
    running += option.price_cad;
    actions.push({
      event: first.ev,
      option,
      alternatives: first.opts.filter((o) => o.key !== option.key),
      corrections: perAgent.flatMap((p) => p.corrections),
      by: option.by,
      duplicate: perAgent.length > 1,
      rule: {
        refundable: option.refundable !== false,
        cancelsAfterWake: !!option.cancel_by && new Date(option.cancel_by).getTime() > wakeAt,
        withinPreauth: running <= preauth,
      },
    });
  }
  // In trip order, so the brief reads like the trip.
  const LEG_ORDER = ["flights", "out", "nyc-stay", "nyc-bos", "bos-stay", "return", "seats"];
  const rank = (t?: string) => (LEG_ORDER.indexOf(t ?? "") + 1 || 99);
  decisions.sort((a, b) => rank(a.event.thread) - rank(b.event.thread) || a.event.ts.localeCompare(b.event.ts));

  // Assumptions: grouped by topic so two agents' readings sit side by side.
  const assumptions: AssumptionView[] = [];
  const byTopic = new Map<string, LogEvent[]>();
  for (const e of events.filter((x) => x.kind === "assumption")) {
    const t = e.topic ?? e.thread ?? e.id;
    byTopic.set(t, [...(byTopic.get(t) ?? []), e]);
  }
  for (const [topic, group] of byTopic) {
    const latest = new Map<string, LogEvent>();
    for (const e of group) latest.set(e.agent, e);
    const readings = [...latest.entries()].map(([agent, event]) => ({ agent, event }));
    const norm = (e: LogEvent) => (e.reading ?? e.headline ?? e.title).toLowerCase().trim();
    const agree = new Set(readings.map((r) => norm(r.event))).size === 1;
    const first = readings[0].event;
    const agentReadings = readings.map((r) => r.event.reading ?? r.event.headline ?? r.event.title);
    const alts = group.flatMap((e) => e.alternatives ?? []);
    assumptions.push({
      id: first.id,
      topic,
      thread: first.thread,
      agree,
      readings,
      headline: agree ? (first.headline ?? first.title) : `${readings.map((r) => agentName(r.agent)).join(" and ")} read ${TOPIC_NOUN[topic] ?? "this"} differently`,
      summary: agree ? first.summary : undefined,
      detail: readings.map((r) => (multi ? `${agentName(r.agent)}: ` : "") + (r.event.summary ?? r.event.detail)).join("\n"),
      choices: [...new Set(agree ? alts.filter((a) => a.toLowerCase() !== norm(first)) : [...agentReadings, ...alts])],
      confidence: first.confidence,
    });
  }

  const reserved = actions.reduce((s, a) => s + a.option.price_cad, 0);
  const held = decisions.reduce((s, d) => s + d.options.filter((o) => o.held).reduce((t, o) => t + o.price_cad, 0), 0);
  const pending = decisions.reduce((s, d) => s + (d.options.find((o) => o.label === d.recommended)?.price_cad ?? 0), 0);

  const mistakes = events.filter((e) => e.kind === "mistake");
  const lapsed = events.filter((e) => e.lost_savings_cad);
  const threadNotes: Record<string, LogEvent[]> = {};
  for (const e of [...mistakes.filter((m) => !m.corrects), ...lapsed, ...events.filter((x) => x.flag)].sort((a, b) => a.ts.localeCompare(b.ts)))
    (threadNotes[e.thread ?? "other"] ??= []).push(e);

  const problemCount =
    audit.claims.filter((c) => c.status === "conflict" || c.status === "unsourced").length +
    mistakes.length +
    (reserved > preauth ? 1 : 0) +
    assumptions.filter((a) => !a.agree).length +
    decisions.filter((d) => d.clash).length;

  return {
    run,
    agentName,
    decisions,
    actions,
    assumptions,
    mistakes,
    lapsed,
    updates: events.filter((e) => e.kind === "update" && !e.lost_savings_cad && !e.updates),
    searches: events.filter((e) => e.kind === "search"),
    timeline: events,
    audit,
    spend: { budget: run.budget_cad, preauth, reserved, held, pending, preauthBreached: reserved > preauth },
    threadNotes,
    problemCount,
  };
}
