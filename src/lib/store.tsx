"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type { ReplanResult } from "@/app/api/replan/route";
import type { RecheckResult } from "@/app/api/recheck/route";

// Everything the user does in the morning. Nothing here reaches Muse directly —
// each choice becomes a line in the outbox, which is sent to Muse as one reply.

export type DecisionState =
  | { status: "open" }
  | { status: "sending" | "queued"; choice: string | null; price: number | null; note?: string; at: number };

export type Replan =
  | { status: "thinking"; text: string; startedAt: number }
  | { status: "done"; text: string; result: ReplanResult; ms: number }
  | { status: "error"; text: string; error: string };

export type Recheck =
  | { status: "checking"; startedAt: number }
  | { status: "done"; result: RecheckResult; at: number }
  | { status: "error"; error: string };

export interface OutboxItem {
  key: string; // one line per thing; later choices replace earlier ones
  text: string;
  at: number;
}

interface State {
  decisions: Record<string, DecisionState>;
  undone: Record<string, "undoing" | "undone">;
  assumptions: Record<string, { choice: string | null; at: number }>;
  replans: Record<string, Replan>;
  rechecks: Record<string, Recheck>;
  rules: Record<string, "accepted" | "declined">;
  outbox: OutboxItem[];
  sentAt: number | null;
  hydrated?: boolean;
}

const initial: State = {
  decisions: {},
  undone: {},
  assumptions: {},
  replans: {},
  rechecks: {},
  rules: {},
  outbox: [],
  sentAt: null,
};

type Action =
  | { t: "decision"; id: string; s: DecisionState }
  | { t: "undo"; id: string; s: "undoing" | "undone" | null }
  | { t: "assume"; id: string; choice: string | null }
  | { t: "replan"; id: string; r: Replan | null }
  | { t: "recheck"; key: string; r: Recheck }
  | { t: "rule"; id: string; v: "accepted" | "declined" }
  | { t: "outbox"; item: OutboxItem | { key: string; text: null } }
  | { t: "sent" }
  | { t: "load"; s: State | null }
  | { t: "reset" };

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "decision":
      return { ...s, decisions: { ...s.decisions, [a.id]: a.s } };
    case "undo": {
      const undone = { ...s.undone };
      if (a.s) undone[a.id] = a.s;
      else delete undone[a.id];
      return { ...s, undone };
    }
    case "assume":
      return { ...s, assumptions: { ...s.assumptions, [a.id]: { choice: a.choice, at: Date.now() } } };
    case "replan": {
      const replans = { ...s.replans };
      if (a.r) replans[a.id] = a.r;
      else delete replans[a.id];
      return { ...s, replans };
    }
    case "recheck":
      return { ...s, rechecks: { ...s.rechecks, [a.key]: a.r } };
    case "rule":
      return { ...s, rules: { ...s.rules, [a.id]: a.v } };
    case "outbox": {
      const rest = s.outbox.filter((o) => o.key !== a.item.key);
      return { ...s, sentAt: null, outbox: a.item.text === null ? rest : [...rest, a.item as OutboxItem] };
    }
    case "sent":
      return { ...s, sentAt: Date.now() };
    case "load":
      return { ...(a.s ?? s), hydrated: true };
    case "reset":
      return { ...initial, hydrated: true };
  }
}

const KEY = "morning-brief:v1";

interface Ctx {
  s: State;
  dispatch: React.Dispatch<Action>;
  now: number;
  queue: (key: string, text: string | null) => void;
}

const StoreCtx = createContext<Ctx | null>(null);

// The page runs on a demo clock anchored to the morning the run finished, so
// "checked 40 min ago" reads the way it did at wake-up no matter when a
// reviewer opens it. It still ticks in real time from there.
export function StoreProvider({ children, anchor }: { children: React.ReactNode; anchor: string }) {
  const [s, dispatch] = useReducer(reducer, initial);
  const [start] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  const anchorMs = useMemo(() => new Date(anchor).getTime() + 4 * 60000, [anchor]);

  useEffect(() => {
    let loaded: State | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        // In-flight requests don't survive a reload.
        parsed.replans = Object.fromEntries(Object.entries(parsed.replans ?? {}).filter(([, r]) => r.status !== "thinking"));
        parsed.rechecks = Object.fromEntries(Object.entries(parsed.rechecks ?? {}).filter(([, r]) => r.status !== "checking"));
        loaded = { ...initial, ...parsed };
      }
    } catch {}
    dispatch({ t: "load", s: loaded });
  }, []);

  useEffect(() => {
    if (!s.hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s]);

  useEffect(() => {
    const i = setInterval(() => setTick(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);

  const queue = useCallback((key: string, text: string | null) => {
    dispatch({ t: "outbox", item: text === null ? { key, text: null } : { key, text, at: Date.now() } });
  }, []);

  const now = anchorMs + (tick - start);
  return <StoreCtx.Provider value={{ s, dispatch, now, queue }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
}

// Converts a real timestamp (Date.now()) onto the demo clock.
export function useDemoTime() {
  const { now } = useStore();
  const [offset] = useState(() => now - Date.now());
  return (real: number) => real + offset;
}
