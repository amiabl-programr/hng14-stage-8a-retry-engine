import type Database from "better-sqlite3";
import { SCHEMA_SQL } from "./statements.js";

export function createSchema(database: Database.Database): void {
  database.exec(SCHEMA_SQL);
}
