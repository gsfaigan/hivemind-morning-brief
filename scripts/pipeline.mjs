#!/usr/bin/env node
// Morning pipeline: each agent's raw export → the brief's data files.
//
//   node scripts/pipeline.mjs ingest <muse|instinct> <raw-export>   normalize one agent's log → src/data/live/log-<agent>.json
//   node scripts/pipeline.mjs reconcile                             line up the same flight/place/question across agents
//   node scripts/pipeline.mjs audit                                 fact-check on the live web + cross-check agents → audit.json, questions-<agent>.md
//   node scripts/pipeline.mjs answers <muse|instinct> <reply-file>  fold an agent's answers into audit.json
//   node scripts/pipeline.mjs use live|sample                       point the app at live or sample data
//
// The normalizer only restructures. It never writes new prices: every number
// it outputs is checked against the raw export, and anything that isn't in
// there is dropped and reported.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const LIVE = process.env.BRIEF_OUT ?? path.join(ROOT, "src/data/live");
const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];
const AGENTS = { muse: "Muse", instinct: "Instinct" };
const agentLogs = () =>
  Object.keys(AGENTS)
    .filter((id) => fs.existsSync(path.join(LIVE, `log-${id}.json`)))
    .map((id) => ({ id, events: read(`log-${id}.json`) }));

function key() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  return env.match(/GEMINI_API_KEY=(.+)/)?.[1].trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gemini(prompt, { search = false } = {}) {
  let last = "";
  for (const model of MODELS) {
    for (let i = 0; i < 3; i++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          ...(search ? { tools: [{ google_search: {} }] } : {}),
          generationConfig: { temperature: 0.1, ...(search ? {} : { responseMimeType: "application/json" }) },
        }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (res.ok) {
        const d = await res.json();
        const text = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
        if (text) return { text, model };
      }
      last = `${model} ${res.status}`;
      process.stderr.write(`  ${last}, retrying…\n`);
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error(last);
}

function json(text) {
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = f ? f[1] : text;
  const s = raw.indexOf("[") !== -1 && (raw.indexOf("[") < raw.indexOf("{") || raw.indexOf("{") === -1) ? "[" : "{";
  const e = s === "[" ? "]" : "}";
  return JSON.parse(raw.slice(raw.indexOf(s), raw.lastIndexOf(e) + 1));
}

const write = (name, data) => {
  fs.mkdirSync(LIVE, { recursive: true });
  fs.writeFileSync(path.join(LIVE, name), typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote src/data/live/${name}`);
};
const read = (name) => JSON.parse(fs.readFileSync(path.join(LIVE, name), "utf8"));

const SCHEMA = `Each event:
{"id":"e01","ts":"ISO 8601 with -04:00","kind":"update|decision|would_book|assumption|mistake|search","thread":"plan|budget|out|nyc-stay|nyc-bos|bos-stay|return|seats|other","title":"the agent's own title","headline":"under 50 chars, the point in plain words, e.g. \"A 6-hour layover, or $200 more to fly direct\"","summary":"one short sentence, under 110 chars, or omit","detail":"the agent's full note, verbatim","options":[{"label":"carrier or place only, short, e.g. \"Porter PD 2113\", \"HI Boston\", \"American, via Philadelphia\"","sub":"room type · neighbourhood, or omit","price":123,"currency":"CAD|USD","refundable":true|false|null,"cancel_by":"ISO or null","source_url":"url or null","checked_at":"ISO or null","held":true|false,"note":"optional","facts":{"key":"canonical id: carrier+flight number, or property name, lowercase-dashed, e.g. porter-2113, hi-nyc, amtrak-171","from":"departure place, e.g. Billy Bishop","to":"arrival place","via":"connection city or omit","depart":"HH:MM 24h","arrive":"HH:MM","layover_min":0,"duration_min":0,"commute_min":0,"nights":0,"window_seat":true|false|null}}],"recommended":"exact label of one option or null","expires_at":"ISO or null","reversible":true|false,"confidence":"high|med|low","alternatives":["other readings, for assumptions only"],"topic":"assumptions only: budget|split|airports|seats|other","reading":"assumptions only: the agent's reading in under 6 words, e.g. CAD, travel and beds","lost_savings_cad":0,"corrects":"id of earlier event this fixes, or omit","updates":"id of the open decision this adds options to or refreshes, or omit","agent":"muse"}

threads: out = Toronto→New York travel; nyc-stay = New York lodging; nyc-bos = New York→Boston travel; bos-stay = Boston lodging; return = Boston→Toronto travel; seats = seat selection; budget/plan = overall; other = anything else.`;

async function ingest(agent, file) {
  if (!AGENTS[agent]) throw new Error(`agent must be one of ${Object.keys(AGENTS).join(", ")}`);
  const NAME = AGENTS[agent];
  const raw = fs.readFileSync(file, "utf8");
  console.log(`ingesting ${file} (${raw.length} chars)`);
  const prompt = `Below is the raw overnight log from a personal AI agent ("${NAME}") that planned a trip while its user slept. It may be JSONL, a chat transcript, or a mix. Convert it to a JSON array of events in this exact schema, in time order.

${SCHEMA}

Rules:
- Never use arrow characters (→, ->) anywhere. Write "to".
- headline and summary are short and plain: no hedging, no filler. They're what the user reads first.
- Keep ${NAME}'s own wording for title and detail. You may shorten a title to under 80 characters, but don't editorialize. Detail stays in ${NAME}'s first-person voice.
- NEVER invent a price, time, URL or fact. If the log doesn't state it, use null or leave it out.
- If ${NAME} later fixed an earlier entry (a wrong price, a wrong airport), mark the fix as kind "mistake" with "corrects" set to the earlier id, and repeat the corrected option.
- If a later entry adds options to, or re-prices, an open decision, set "updates" to that decision's id.
- "would_book" = ${NAME} reserved or WOULD_BOOK something on its own. "decision" = ${NAME} is waiting for the user to pick.
- Assumptions should include 1-3 plausible "alternatives" the user might flip to, taken from context. If you truly can't tell, leave the array empty.
- Every WOULD_BOOK should have the chosen option first and as "recommended".
- Currency: keep what ${NAME} reported. If it didn't say, assume CAD.

RAW LOG:
${raw}`;
  const { text, model } = await gemini(prompt);
  let events = json(text);

  // Guard: every price must appear in the raw export.
  const nums = new Set((raw.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ""))));
  const dropped = [];
  // Ids are prefixed per agent so two logs can be merged.
  const remap = {};
  events.forEach((e, i) => (remap[e.id] = `${agent[0]}${String(i + 1).padStart(2, "0")}`));
  for (const e of events) {
    e.id = remap[e.id];
    if (e.corrects) e.corrects = remap[e.corrects];
    if (e.updates) e.updates = remap[e.updates];
    e.agent = agent;
    if (!e.options) continue;
    e.options = e.options.filter((o) => {
      const ok = typeof o.price === "number" && nums.has(o.price);
      if (!ok) dropped.push(`${e.id} ${o.label} $${o.price}`);
      return ok;
    });
    if (!e.options.length) delete e.options;
  }
  if (dropped.length) console.warn(`dropped ${dropped.length} options whose price isn't in the raw log:\n  ${dropped.join("\n  ")}`);

  events.sort((a, b) => a.ts.localeCompare(b.ts));
  write(`log-${agent}.json`, events);
  writeRun();
  console.log(`${events.length} events via ${model}. Counts:`, Object.fromEntries(["decision", "would_book", "assumption", "mistake", "update", "search"].map((k) => [k, events.filter((e) => e.kind === k).length])));
  console.log("Next: ingest the other agent, then: node scripts/pipeline.mjs reconcile");
}

function writeRun() {
  const logs = agentLogs();
  const all = logs.flatMap((l) => l.events).sort((a, b) => a.ts.localeCompare(b.ts));
  if (!all.length) return;
  write("run.json", {
    agents: logs.map((l) => ({ id: l.id, name: AGENTS[l.id] })),
    started_at: all[0].ts,
    ended_at: all[all.length - 1].ts,
    wake_at: new Date(new Date(all[all.length - 1].ts).getTime() + 10 * 60000).toISOString().replace("Z", "+00:00"),
    task: "Book my reading week trip - going from Toronto to New York to Boston and back, leaving October 10, home by October 18, under $1,500 total, find window seats where you can.",
    budget_cad: 1500,
    preauth_cad: 750,
    sample: false,
  });
}

// Two separately-normalized logs name the same flight differently. Ask for one
// shared key per real-world item and one shared topic per assumption.
async function reconcile() {
  const logs = agentLogs();
  if (logs.length < 2) return console.log("only one agent ingested; nothing to reconcile");
  const items = logs.flatMap((l) =>
    l.events.flatMap((e) => [
      ...(e.options ?? []).map((o, i) => ({ ref: `${e.id}.${i}`, agent: l.id, thread: e.thread, label: o.label, key: o.facts?.key, price: o.price, depart: o.facts?.depart })),
      ...(e.kind === "assumption" ? [{ ref: e.id, agent: l.id, assumption: e.headline ?? e.title, topic: e.topic, reading: e.reading }] : []),
    ]),
  );
  const prompt = `Two AI agents planned the same trip independently. Below are the options and assumptions each logged. Give every real-world item ONE shared key: if both agents mean the same flight (same carrier + time/flight number), the same hotel/hostel, or the same train/bus, they must get the same key. Different items get different keys. For assumptions, give the same topic to assumptions about the same question (e.g. both about the budget currency = "budget"), and a short reading (under 6 words) each.

${JSON.stringify(items)}

Reply with ONLY JSON: {"options":{"<ref>":"<key>"},"assumptions":{"<ref>":{"topic":"...","reading":"..."}}}`;
  const { text } = await gemini(prompt);
  const r = json(text);
  let n = 0;
  for (const l of logs) {
    for (const e of l.events) {
      (e.options ?? []).forEach((o, i) => {
        const k = r.options?.[`${e.id}.${i}`];
        if (k) ((o.facts ??= {}).key = k), n++;
      });
      const a = r.assumptions?.[e.id];
      if (a) Object.assign(e, a);
    }
    write(`log-${l.id}.json`, l.events);
  }
  console.log(`reconciled ${n} options across ${logs.map((l) => l.id).join(" + ")}. Next: node scripts/pipeline.mjs audit`);
}

async function audit() {
  const logs = agentLogs();
  const events = logs.flatMap((l) => l.events).sort((a, b) => a.ts.localeCompare(b.ts));
  const claims = [];
  const interrogations = [];
  const questions = [];
  const targets = events.filter((e) => e.options?.length && e.kind !== "search");
  // The auditor misreads dates without this: give it the plan the agents worked to.
  const plan = events.filter((e) => e.kind === "assumption").map((e) => `- ${AGENTS[e.agent]}: ${e.headline ?? e.title}`).join("\n");
  const LEG = {
    out: "one-way Toronto → New York on Sat Oct 10, 2026",
    "nyc-stay": "New York lodging for the whole NYC stay (see plan; default Oct 10–14, 4 nights). Prices are totals for the stay",
    "nyc-bos": "one-way New York → Boston (default Wed Oct 14, 2026)",
    "bos-stay": "Boston lodging for the whole Boston stay (default Oct 14–18, 4 nights). Prices are totals for the stay",
    return: "one-way Boston → Toronto on Sun Oct 18, 2026 (or overnight Oct 17→18)",
  };
  let qn = 0;

  for (const e of targets) {
    process.stdout.write(`checking ${e.id} ${e.title.slice(0, 50)}… `);
    const prompt = `You are auditing an AI travel agent's overnight work. For each option below, search the live web and check whether the reported price and facts hold up for the stated dates (Oct 10-18, 2026; Toronto → New York → Boston → Toronto). Be skeptical and specific. If you can't find the exact item, say so. Don't guess.

The agent's plan and assumptions:
${plan}

This entry is about: ${LEG[e.thread] ?? "the trip overall"}. All prices are one-way/one-stay totals unless the entry says otherwise.

Agent's entry (${e.ts}): ${e.title}
${e.detail}
Options:
${e.options.map((o) => `- ${o.label}: ${o.price} ${o.currency}${o.source_url ? ` (source: ${o.source_url})` : " (no source given)"}${o.refundable === false ? " non-refundable" : ""}`).join("\n")}

Reply with ONLY a JSON object:
{"claims":[{"option_label":"exact label","claim":"what the agent claimed, short","status":"verified|conflict|unsourced|stale|unverifiable","observed":"what you found, short, or null","note":"one plain sentence for the traveller","web_question":"the question you effectively asked the web","web_answer":"what the web said, one sentence"}],"question_for_agent":"one pointed question to ask the agent about the weakest claim here, or null"}

status guide: verified = found and matches (within ~5%); conflict = found and materially differs; unsourced = no source link and you can't find it; stale = the item exists but the price has clearly moved; unverifiable = can't be checked (expired, behind a login, too specific).`;
    try {
      const { text, model } = await gemini(prompt, { search: true });
      const r = json(text);
      const at = new Date().toISOString();
      for (const c of r.claims ?? []) {
        claims.push({ event_id: e.id, option_label: c.option_label, claim: c.claim, status: c.status, observed: c.observed ?? undefined, checked_at: at, note: c.note });
        if (c.web_question)
          interrogations.push({ id: `w${interrogations.length + 1}`, event_id: e.id, at, asker: "auditor", target: "web", q: c.web_question, a: c.web_answer ?? c.note, verdict: c.status });
      }
      if (r.question_for_agent) questions.push({ id: `q${++qn}`, agent: e.agent, event_id: e.id, q: r.question_for_agent });
      console.log(`${(r.claims ?? []).map((c) => c.status).join(", ")} (${model})`);
    } catch (err) {
      console.log(`failed: ${err.message}`);
    }
    await sleep(4000); // free-tier rate limit
  }

  // Cross-check: where the agents overlap, ask each about the other's version.
  if (logs.length > 1) {
    process.stdout.write("cross-checking agents… ");
    const brief = events
      .filter((e) => e.options?.length || e.kind === "assumption")
      .map((e) => ({ id: e.id, agent: e.agent, kind: e.kind, thread: e.thread, headline: e.headline ?? e.title, reading: e.reading, options: (e.options ?? []).map((o) => ({ label: o.label, key: o.facts?.key, price: o.price, currency: o.currency, refundable: o.refundable })) }));
    const prompt = `Two AI agents (${logs.map((l) => AGENTS[l.id]).join(", ")}) planned the same trip overnight, independently. Find where they disagree: different prices for the same item (same key), different assumptions on the same topic, both booking the same leg, or one breaking a rule the other kept (the rule: nothing non-refundable overnight, stay under $750 total). For each disagreement, write ONE pointed question to the agent most likely to be wrong, citing the other agent's version.

${JSON.stringify(brief)}

Reply with ONLY JSON: [{"agent":"muse|instinct","event_id":"...","q":"..."}] (at most 6)`;
    try {
      const { text } = await gemini(prompt);
      for (const c of json(text)) if (AGENTS[c.agent]) questions.push({ id: `q${++qn}`, agent: c.agent, event_id: c.event_id, q: c.q });
      console.log("done");
    } catch (err) {
      console.log(`failed: ${err.message}`);
    }
  }

  write("audit.json", { generated_at: new Date().toISOString(), model: "gemini-2.5-flash", claims, interrogations, pending_questions: questions });
  for (const l of logs) {
    const mine = questions.filter((q) => q.agent === l.id);
    write(
      `questions-${l.id}.md`,
      `Paste this into ${AGENTS[l.id]}, save its full reply to a file, then run:\n  node scripts/pipeline.mjs answers ${l.id} <file>\n\n---\n\nA few questions from my fact-checker before I decide. Answer each by number, briefly:\n\n${mine.map((q) => `${q.id}. ${q.q}`).join("\n")}\n`,
    );
  }
  const tally = claims.reduce((t, c) => ((t[c.status] = (t[c.status] ?? 0) + 1), t), {});
  console.log("claims:", tally, "· questions:", Object.fromEntries(logs.map((l) => [l.id, questions.filter((q) => q.agent === l.id).length])));
}

async function answers(agent, file) {
  const a = read("audit.json");
  const reply = fs.readFileSync(file, "utf8");
  const qs = (a.pending_questions ?? []).filter((q) => q.agent === agent);
  const prompt = `An auditor asked an AI agent these questions:
${qs.map((q) => `${q.id}: ${q.q}`).join("\n")}

The agent replied:
${reply}

For each question, extract the agent's answer in its own words (shorten to at most 2 sentences) and judge whether it resolves the concern.
Reply with ONLY JSON: [{"id":"q1","answer":"...","verdict":"verified|conflict|unsourced|unverifiable"}]`;
  const { text } = await gemini(prompt);
  const parsed = json(text);
  const at = new Date().toISOString();
  for (const p of parsed) {
    const q = qs.find((x) => x.id === p.id);
    if (!q) continue;
    a.interrogations.push({ id: `m${p.id}`, event_id: q.event_id, at, asker: "auditor", target: agent, q: q.q, a: p.answer, verdict: p.verdict });
  }
  a.interrogations.sort((x, y) => x.at.localeCompare(y.at));
  write("audit.json", a);
  console.log(`added ${parsed.length} ${AGENTS[agent]} answers`);
}

function use(which) {
  if (which === "live") {
    // The app imports one log per agent; an agent that never exported gets an empty log.
    for (const id of Object.keys(AGENTS)) if (!fs.existsSync(path.join(LIVE, `log-${id}.json`))) write(`log-${id}.json`, []);
    if (!fs.existsSync(path.join(LIVE, "audit.json"))) write("audit.json", { generated_at: new Date().toISOString(), model: "none", claims: [], interrogations: [] });
    writeRun();
  }
  const p = path.join(ROOT, "src/data/index.ts");
  const s = fs.readFileSync(p, "utf8").replace(/\.\/(sample|live)\//g, `./${which}/`);
  fs.writeFileSync(p, s);
  console.log(`app now reads src/data/${which}/`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
const cmds = { ingest: () => ingest(arg, arg2), reconcile, audit, answers: () => answers(arg, arg2), use: () => use(arg) };
if (!cmds[cmd]) {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 9).join("\n"));
  process.exit(1);
}
await cmds[cmd]();
