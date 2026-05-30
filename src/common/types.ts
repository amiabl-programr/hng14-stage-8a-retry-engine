export const REQUEST_STATUS = {
  PENDING: "pending",
  RETRYING: "retrying",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface RequestRow {
  id: string;
  url: string;
  method: HttpMethod;
  body: string | null;
  status: RequestStatus;
  attemptCount: number;
  maxRetries: number;
  backoffMs: number;
  nextRetryAt: number;
  lastError: string | null;
  result: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AttemptRow {
  id: number;
  requestId: string;
  attemptNumber: number;
  statusCode: number | null;
  error: string | null;
  delay: number;
  timestamp: number;
}

export interface CreateRequestPayload {
  url: string;
  method: HttpMethod;
  body?: unknown;
  maxRetries?: number;
  backoffMs?: number;
}
