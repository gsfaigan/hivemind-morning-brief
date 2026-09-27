// One line of the agent's overnight log, normalized. Muse writes the core
// fields (see prompts/02-bedtime-rules.md); `thread` and `facts` are added at
// ingest so the brief can group related events and run anomaly checks.

export type Kind =
  | "update"
  | "decision"
  | "would_book"
  | "assumption"
  | "mistake"
  | "search";

export type Thread =
  | "plan"
  | "budget"
  | "out"
  | "nyc-stay"
  | "nyc-bos"
  | "bos-stay"
  | "return"
  | "seats"
  | "other";

export interface OptionFacts {
  from?: string; // place names for the stacked departure/arrival block
  to?: string;
  via?: string;
  depart?: string; // "06:50"
  arrive?: string;
  layover_min?: number;
  duration_min?: number;
  commute_min?: number; // lodging to main sights
  nights?: number;
  window_seat?: boolean | null;
}

export interface Option {
  label: string; // carrier or place, short, no route
  sub?: string; // room type, neighbourhood, etc.
  price: number;
  currency: string;
  price_cad?: number; // normalized at ingest
  refundable?: boolean | null;
  cancel_by?: string | null;
  source_url?: string | null;
  checked_at?: string | null;
  held?: boolean;
  note?: string;
  facts?: OptionFacts;
}

export interface LogEvent {
  id: string;
  ts: string;
  kind: Kind;
  title: string;
  detail: string; // Muse's full note, shown behind "Why"
  headline?: string; // under ~50 chars, the point in plain words
  summary?: string; // one sentence
  options?: Option[];
  recommended?: string | null;
  expires_at?: string | null;
  reversible?: boolean;
  confidence?: "high" | "med" | "low";
  thread?: Thread;
  alternatives?: string[]; // for assumptions: other readings the user can flip to
  lost_savings_cad?: number; // for things the agent deliberately let lapse
  corrects?: string; // id of an earlier event this one fixes (replaces its prices)
  updates?: string; // id of an open decision this one adds/refreshes options on
  agent: string;
}

export type AuditStatus = "verified" | "unsourced" | "conflict" | "stale" | "unverifiable";

export interface AuditClaim {
  event_id: string;
  option_label?: string;
  claim: string;
  status: AuditStatus;
  observed?: string;
  checked_at: string;
  note: string;
}

export interface Interrogation {
  id: string;
  event_id?: string;
  at: string;
  asker: "auditor";
  target: "muse" | "web";
  q: string;
  a: string;
  verdict?: AuditStatus;
}

export interface Audit {
  generated_at: string;
  model: string;
  claims: AuditClaim[];
  interrogations: Interrogation[];
}

export interface Run {
  agent: string;
  started_at: string;
  ended_at: string;
  task: string;
  budget_cad: number;
  preauth_cad: number;
  wake_at: string;
  sample: boolean; // true until the real overnight log replaces it
}
