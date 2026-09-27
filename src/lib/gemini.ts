import "server-only";

// Free-tier Gemini is bursty (503s under load), so try a short chain of models
// and retry once each before giving up.
const MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.5-flash-lite"];

export interface GeminiResult {
  text: string;
  model: string;
  sources: { title: string; uri: string }[];
}

export async function ask(prompt: string, opts: { search?: boolean; urls?: boolean; timeoutMs?: number } = {}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const tools: object[] = [];
  if (opts.search) tools.push({ google_search: {} });
  if (opts.urls) tools.push({ url_context: {} });

  let lastErr = "";
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            ...(tools.length ? { tools } : {}),
            generationConfig: { temperature: 0.3 },
          }),
          signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
        });
        if (!res.ok) {
          lastErr = `${model} ${res.status}`;
          if (res.status === 429 || res.status >= 500) continue;
          throw new Error(lastErr);
        }
        const data = await res.json();
        const cand = data.candidates?.[0];
        const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
        const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
          .map((c: { web?: { title: string; uri: string } }) => c.web)
          .filter(Boolean);
        if (text) return { text, model, sources };
        lastErr = `${model} empty`;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
  }
  throw new Error(lastErr || "Gemini unavailable");
}

export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(raw) as T;
}
