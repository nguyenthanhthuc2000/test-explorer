import type { AppConfig } from "../../core/config";
import { defaultConfig } from "../../core/config";
import { getDb } from "../client";

type Row = {
  data_json: string;
};

export function getConfig(): AppConfig {
  const db = getDb();
  const row = db.prepare("SELECT data_json FROM app_config WHERE id = 1").get() as Row | undefined;
  if (!row) return defaultConfig;
  try {
    return JSON.parse(row.data_json) as AppConfig;
  } catch {
    return defaultConfig;
  }
}

export function setConfig(next: AppConfig) {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO app_config (id, updated_at, data_json) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, data_json = excluded.data_json"
  ).run(updatedAt, JSON.stringify(next));
}

