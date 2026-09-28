// Swap "./sample" for "./live" once the real overnight runs are ingested
// (npm run brief -- use live). One log per agent.
import run from "./sample/run.json";
import muse from "./sample/log-muse.json";
import instinct from "./sample/log-instinct.json";
import audit from "./sample/audit.json";
import type { Audit, LogEvent, Run } from "@/lib/types";

export const data = {
  run: run as Run,
  log: [...(muse as LogEvent[]), ...(instinct as LogEvent[])],
  audit: audit as Audit,
};
