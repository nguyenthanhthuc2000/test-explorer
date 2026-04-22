import type { RunReport } from "../../core/types";
import { getDb } from "../client";

export type RunRow = {
  id: string;
  url: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  config_json: string;
  ai_summary: string | null;
};

export function insertRun(report: RunReport, configJson: string) {
  const db = getDb();
  db.prepare(
    "INSERT INTO runs (id, url, status, started_at, finished_at, config_json, ai_summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(
    report.runId,
    report.url,
    report.status,
    report.startedAt,
    report.finishedAt ?? null,
    configJson,
    report.aiSummary ?? null
  );
}

export function listRuns(limit = 50): RunRow[] {
  const db = getDb();
  return db
    .prepare("SELECT id, url, status, started_at, finished_at, config_json, ai_summary FROM runs ORDER BY started_at DESC LIMIT ?")
    .all(limit) as RunRow[];
}

export function getRun(id: string): RunRow | null {
  const db = getDb();
  const row = db
    .prepare("SELECT id, url, status, started_at, finished_at, config_json, ai_summary FROM runs WHERE id = ?")
    .get(id) as RunRow | undefined;
  return row ?? null;
}

export function clearAllHistory() {
  const db = getDb();
  const tx = db.transaction(() => {
    const stepsDeleted = db.prepare("DELETE FROM steps").run().changes;
    const runsDeleted = db.prepare("DELETE FROM runs").run().changes;
    return { runsDeleted, stepsDeleted };
  });
  return tx();
}

export function countHistory() {
  const db = getDb();
  const runs = (db.prepare("SELECT COUNT(1) as c FROM runs").get() as { c: number }).c;
  const steps = (db.prepare("SELECT COUNT(1) as c FROM steps").get() as { c: number }).c;
  return { runs, steps };
}

