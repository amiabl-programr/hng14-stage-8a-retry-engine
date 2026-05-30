import { v4 as uuidv4 } from "uuid";
import type { CreateRequestPayload, RequestRow } from "../common/types.js";
import { REQUEST_STATUS } from "../common/types.js";
import { getStatements, buildUpdateStatement } from "./statements.js";

export function insertRequest(payload: CreateRequestPayload): RequestRow {
  const id = uuidv4();
  const now = Date.now();
  const maxRetries = payload.maxRetries ?? 5;
  const backoffMs = payload.backoffMs ?? 1000;
  const body = payload.body !== undefined ? JSON.stringify(payload.body) : null;

  getStatements().insertRequest.run(
    id,
    payload.url,
    payload.method,
    body,
    REQUEST_STATUS.PENDING,
    maxRetries,
    backoffMs,
    now,
    now,
    now,
  );

  return getRequest(id)!;
}

export function getRequest(id: string): RequestRow | undefined {
  return getStatements().getRequestById.get(id) as RequestRow | undefined;
}

export function listRequests(status?: string): RequestRow[] {
  if (status) {
    return getStatements().listRequestsByStatus.all(status) as RequestRow[];
  }
  return getStatements().listRequests.all() as RequestRow[];
}

export function updateRequestStatus(
  id: string,
  updates: Partial<{
    status: string;
    attemptCount: number;
    nextRetryAt: number;
    lastError: string | null;
    result: string | null;
  }>,
): void {
  const now = Date.now();
  const fields: string[] = ["updatedAt"];
  const values: unknown[] = [now];

  if (updates.status !== undefined) {
    fields.push("status");
    values.push(updates.status);
  }
  if (updates.attemptCount !== undefined) {
    fields.push("attemptCount");
    values.push(updates.attemptCount);
  }
  if (updates.nextRetryAt !== undefined) {
    fields.push("nextRetryAt");
    values.push(updates.nextRetryAt);
  }
  if (updates.lastError !== undefined) {
    fields.push("lastError");
    values.push(updates.lastError);
  }
  if (updates.result !== undefined) {
    fields.push("result");
    values.push(updates.result);
  }

  values.push(id);
  buildUpdateStatement(fields).run(...values);
}

export function getDueRequests(now: number): RequestRow[] {
  return getStatements().getDueRequests.all(
    REQUEST_STATUS.PENDING,
    REQUEST_STATUS.RETRYING,
    now,
  ) as RequestRow[];
}
