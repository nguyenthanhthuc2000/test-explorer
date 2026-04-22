import type { StepResult } from "../../core/types";
import { getDb } from "../client";

export type StepRow = {
  id: string;
  run_id: string;
  idx: number;
  title: string;
  status: string;
  details: string | null;
  created_at: string;
};

export function insertSteps(runId: string, steps: StepResult[]) {
  const db = getDb();
  const createdAt = new Date().toISOString();
  const stmt = db.prepare(
    "INSERT INTO steps (id, run_id, idx, title, status, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const tx = db.transaction(() => {
    steps.forEach((s, idx) => {
      stmt.run(s.id, runId, idx, s.title, s.status, s.details ?? null, createdAt);
    });
  });
  tx();
}

export function listSteps(runId: string): StepRow[] {
  const db = getDb();
  return db
    .prepare("SELECT id, run_id, idx, title, status, details, created_at FROM steps WHERE run_id = ? ORDER BY idx ASC")
    .all(runId) as StepRow[];
}

