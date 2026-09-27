import { ask, parseJson } from "@/lib/gemini";

export const maxDuration = 60;

export interface RecheckResult {
  status: "same" | "changed" | "unavailable" | "unknown";
  observed_price_cad: number | null;
  note: string;
  model: string;
  sources: { title: string; uri: string }[];
}

export async function POST(req: Request) {
  const { label, price_cad, source_url, when } = (await req.json()) as {
    label: string;
    price_cad: number;
    source_url?: string | null;
    when: string;
  };

  const prompt = `An AI travel agent reported this price overnight. Independently check whether it is still accurate right now.

ITEM: ${label}
TRAVEL DATE(S): ${when}
REPORTED: $${price_cad} CAD
SOURCE THE AGENT CITED: ${source_url ?? "none"}

Search for the current price from the airline/rail/hotel's own site or a major aggregator. Be skeptical: if you can't find this exact item, say so instead of guessing.

Reply with ONLY this JSON:
{"status":"same|changed|unavailable|unknown","observed_price_cad":123 or null,"note":"under 15 words, plain, e.g. \"Same fare on amtrak.com\" or \"Couldn't find this exact train\""}`;

  try {
    const r = await ask(prompt, { search: true, urls: !!source_url });
    const parsed = parseJson<Omit<RecheckResult, "model" | "sources">>(r.text);
    return Response.json({ ...parsed, model: r.model, sources: r.sources.slice(0, 3) } satisfies RecheckResult);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "recheck failed" }, { status: 502 });
  }
}
