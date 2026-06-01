import { v4 as uuidv4 } from "uuid";
import type { AttemptRow } from "../common/types.js";
import { getStatements } from "./statements.js";

export function insertAttempt(attempt: Omit<AttemptRow, "id" | "timestamp">): void {
  const now = new Date().toISOString();
  getStatements().insertAttempt.run(
    uuidv4(),
    attempt.requestId,
    attempt.attemptNumber,
    attempt.statusCode ?? null,
    attempt.error ?? null,
    attempt.delay,
    now,
  );
}

export function getAttemptsByRequestId(requestId: string): AttemptRow[] {
  return getStatements().getAttemptsByRequestId.all(requestId) as AttemptRow[];
}
