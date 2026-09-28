// Swap "./sample" for "./live" once the real overnight runs are ingested
// (npm run brief -- use live). One log per agent.
import run from "./live/run.json";
import muse from "./live/log-muse.json";
import instinct from "./live/log-instinct.json";
import audit from "./live/audit.json";
import type { Audit, LogEvent, Run } from "@/lib/types";

export const data = {
  run: run as Run,
  log: [...(muse as LogEvent[]), ...(instinct as LogEvent[])],
  audit: audit as Audit,
};
