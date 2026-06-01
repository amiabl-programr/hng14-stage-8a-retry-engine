import type Database from "better-sqlite3";
import { getDatabase } from "./client.js";

interface PreparedStatements {
  insertRequest: Database.Statement;
  getRequestById: Database.Statement;
  listRequests: Database.Statement;
  listRequestsByStatus: Database.Statement;
  getDueRequests: Database.Statement;
  insertAttempt: Database.Statement;
  getAttemptsByRequestId: Database.Statement;
}

let statements: PreparedStatements;

function prepareStatements(database: Database.Database): PreparedStatements {
  return {
    insertRequest: database.prepare(`
      INSERT INTO requests (id, url, method, body, status, attemptCount, maxRetries, backoffMs, nextRetryAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `),
    getRequestById: database.prepare("SELECT * FROM requests WHERE id = ?"),
    listRequests: database.prepare("SELECT * FROM requests ORDER BY createdAt DESC"),
    listRequestsByStatus: database.prepare(
      "SELECT * FROM requests WHERE status = ? ORDER BY createdAt DESC",
    ),
    getDueRequests: database.prepare(
      `SELECT * FROM requests
       WHERE status IN (?, ?)
         AND nextRetryAt <= ?
       ORDER BY nextRetryAt ASC`,
    ),
    insertAttempt: database.prepare(`
      INSERT INTO attempts (id, requestId, attemptNumber, statusCode, error, delay, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `),
    getAttemptsByRequestId: database.prepare(
      "SELECT * FROM attempts WHERE requestId = ? ORDER BY attemptNumber ASC",
    ),
  };
}

export function getStatements(): PreparedStatements {
  if (statements) return statements;
  statements = prepareStatements(getDatabase());
  return statements;
}

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS requests (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    method      TEXT NOT NULL,
    body        TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    attemptCount INTEGER NOT NULL DEFAULT 0,
    maxRetries  INTEGER NOT NULL DEFAULT 5,
    backoffMs   INTEGER NOT NULL DEFAULT 1000,
    nextRetryAt TEXT NOT NULL DEFAULT (datetime('now')),
    lastError   TEXT,
    result      TEXT,
    createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id            TEXT PRIMARY KEY,
    requestId     TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    attemptNumber INTEGER NOT NULL,
    statusCode    INTEGER,
    error         TEXT,
    delay         INTEGER NOT NULL,
    timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_requests_status_nextRetryAt
    ON requests(status, nextRetryAt);

  CREATE INDEX IF NOT EXISTS idx_attempts_requestId
    ON attempts(requestId);
`;

export function buildUpdateStatement(fields: string[]): Database.Statement {
  const database = getDatabase();
  const setClause = fields.map((field) => `${field} = ?`).join(", ");
  return database.prepare(`UPDATE requests SET ${setClause} WHERE id = ?`);
}
