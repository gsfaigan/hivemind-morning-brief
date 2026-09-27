export const USD_CAD = 1.37;

export function toCad(price: number, currency: string) {
  return currency.toUpperCase() === "USD" ? Math.round(price * USD_CAD) : price;
}

export function money(n: number, opts: { sign?: boolean } = {}) {
  const s = `$${Math.abs(Math.round(n)).toLocaleString("en-CA")}`;
  if (opts.sign) return n > 0 ? `+${s}` : n < 0 ? `−${s}` : "±$0";
  return n < 0 ? `−${s}` : s;
}

export function clock(iso: string) {
  const d = new Date(iso);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" })
    .replace(" ", " ");
}

export function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  });
}

export function ago(iso: string, now: number) {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h < 24) return r && h < 3 ? `${h}h ${r}m ago` : `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function until(iso: string, now: number) {
  const m = Math.round((new Date(iso).getTime() - now) / 60000);
  if (m <= 0) return "expired";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
  return `${Math.floor(h / 24)} days`;
}

export function minutes(m: number) {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h}h${r ? ` ${r}m` : ""}` : `${r}m`;
}

export function ampm(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}\u202f${h < 12 ? "AM" : "PM"}`;
}

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
export const countWord = (n: number) => WORDS[n] ?? String(n);
