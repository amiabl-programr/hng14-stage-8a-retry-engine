import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import logger from "../config/logger.js";
import { env } from "../config/env.js";

const DB_PATH = env.DB_PATH;

let db: Database.Database | undefined;

export function getDatabase(): Database.Database {
  if (db) return db;

  try {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    logger.info({ path: DB_PATH }, "SQLite database opened");
  } catch (err) {
    db = undefined;
    logger.error({ err, path: DB_PATH }, "Failed to open SQLite database");
    throw err;
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = undefined;
    logger.info("SQLite database closed");
  }
}
