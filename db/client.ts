import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

export type DbInitOptions = {
  userDataDir: string;
};

export function initDb(opts: DbInitOptions) {
  if (db) return db;

  fs.mkdirSync(opts.userDataDir, { recursive: true });
  const dbPath = path.join(opts.userDataDir, "ai-qa.sqlite");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  applySchema(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error("DB not initialized. Call initDb() first.");
  return db;
}

function applySchema(d: Database.Database) {
  const schemaPath = path.resolve(process.cwd(), "db/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  d.exec(sql);
}

