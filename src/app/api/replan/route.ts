import { ask, parseJson } from "@/lib/gemini";

export const maxDuration = 60;

interface Body {
  instruction: string;
  decision: {
    title: string;
    detail: string;
    recommended: string | null;
    options: { label: string; price_cad: number; refundable?: boolean | null; held?: boolean; facts?: object; note?: string }[];
  };
  budget: { total: number; committedElsewhere: number };
  trip: string;
}

export interface ReplanOption {
  label: string;
  price_cad: number | null;
  why: string;
  source_url: string | null;
  new: boolean;
}

export interface ReplanResult {
  summary: string;
  options: ReplanOption[];
  recommended: string | null;
  tradeoff: string;
  instruction_for_agent: string;
  model: string;
  sources: { title: string; uri: string }[];
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const room = body.budget.total - body.budget.committedElsewhere;

  const prompt = `You supervise a personal travel agent ("Muse") that worked overnight while its user slept. The user just woke up and redirected one of its decisions. Re-plan that decision.

TRIP: ${body.trip}
BUDGET: $${body.budget.total} CAD total. $${body.budget.committedElsewhere} is already committed to other legs, so this decision has $${room} of room before going over.

DECISION: ${body.decision.title}
${body.decision.detail}
Muse recommended: ${body.decision.recommended ?? "nothing"}
Options Muse found (prices in CAD):
${body.decision.options.map((o) => `- ${o.label} — $${o.price_cad}${o.held ? " (on hold)" : ""}${o.refundable === false ? " (non-refundable)" : ""}${o.note ? ` — ${o.note}` : ""} ${o.facts ? JSON.stringify(o.facts) : ""}`).join("\n")}

USER'S REDIRECT: "${body.instruction}"

Do this:
1. Take the redirect literally. If it asks for something Muse's options don't cover, use Google Search to find real current options. Never invent a price: if you can't find one, set price_cad to null.
2. Keep any of Muse's options that still fit the redirect.
3. Give at most 4 options, best first.

Reply with ONLY this JSON:
{"summary":"1-2 short sentences to the user, second person, plain (e.g. \"Two directs fit. Porter is cheapest and gets you home by 3.\")","options":[{"label":"carrier or place, short, e.g. \"Porter, direct 1:15 PM\" (never use arrows)","price_cad":123,"why":"one short clause","source_url":"https://... or null","new":true}],"recommended":"label of best option or null","tradeoff":"what the user gives up, under 15 words","instruction_for_agent":"a short direct message to send Muse so it can execute this"}`;

  try {
    const r = await ask(prompt, { search: true });
    const parsed = parseJson<Omit<ReplanResult, "model" | "sources">>(r.text);
    return Response.json({ ...parsed, model: r.model, sources: r.sources.slice(0, 5) } satisfies ReplanResult);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "replan failed" }, { status: 502 });
  }
}
