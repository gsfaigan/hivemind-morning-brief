// Swap "./sample" for "./live" once the real overnight run is ingested
// (npm run ingest writes src/data/live/*.json).
import run from "./sample/run.json";
import log from "./sample/log.json";
import audit from "./sample/audit.json";
import type { Audit, LogEvent, Run } from "@/lib/types";

export const data = {
  run: run as Run,
  log: log as LogEvent[],
  audit: audit as Audit,
};
