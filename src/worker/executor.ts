import axios from "axios";
import { StatusCodes } from "http-status-codes";
import logger from "../config/logger.js";
import type { RequestRow } from "../common/types.js";
import { REQUEST_STATUS } from "../common/types.js";
import { updateRequestStatus } from "../db/requests.js";
import { insertAttempt } from "../db/attempts.js";
import { computeDelay } from "./backoff.js";

const AXIOS_TIMEOUT_MS = 10_000;
const RESPONSE_BODY_CAP = 10_240;

function isRetriable(statusCode: number): boolean {
  if (statusCode === StatusCodes.REQUEST_TIMEOUT) return true;
  if (statusCode === StatusCodes.TOO_MANY_REQUESTS) return true;
  if (statusCode === 499) return true;
  if (statusCode >= 500) return true;
  return false;
}

async function executeAttempt(
  row: RequestRow,
): Promise<
  { success: true; data: string } | { success: false; statusCode: number | null; error: string }
> {
  try {
    const response = await axios({
      method: row.method as string,
      url: row.url,
      data: row.body ?? undefined,
      timeout: AXIOS_TIMEOUT_MS,
      validateStatus: () => true,
    });

    const body =
      typeof response.data === "string"
        ? response.data.slice(0, RESPONSE_BODY_CAP)
        : JSON.stringify(response.data).slice(0, RESPONSE_BODY_CAP);

    if (response.status >= 200 && response.status < 300) {
      return { success: true, data: body };
    }

    return { success: false, statusCode: response.status, error: `HTTP ${response.status}` };
  } catch (err) {
    if (!axios.isAxiosError(err)) {
      return {
        success: false,
        statusCode: null,
        error: `Unexpected error: ${(err as Error).message}`,
      };
    }

    if (err.response) {
      const status = err.response.status;
      return { success: false, statusCode: status, error: `HTTP ${status}` };
    }

    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return { success: false, statusCode: null, error: "Request timed out" };
    }

    return { success: false, statusCode: null, error: `Network error: ${err.code ?? err.message}` };
  }
}

export async function executeRequest(row: RequestRow): Promise<void> {
  const attemptNumber = row.attemptCount + 1;
  const result = await executeAttempt(row);

  if (result.success) {
    insertAttempt({
      requestId: row.id,
      attemptNumber,
      statusCode: 200,
      error: null,
      delay: 0,
    });

    updateRequestStatus(row.id, {
      status: REQUEST_STATUS.COMPLETED,
      result: result.data,
      lastError: null,
    });

    logger.info({ requestId: row.id, attemptNumber }, "Request completed successfully");
    return;
  }

  const isTerminal = result.statusCode !== null && !isRetriable(result.statusCode);

  if (isTerminal || attemptNumber >= row.maxRetries) {
    insertAttempt({
      requestId: row.id,
      attemptNumber,
      statusCode: result.statusCode,
      error: result.error,
      delay: 0,
    });

    updateRequestStatus(row.id, {
      status: REQUEST_STATUS.FAILED,
      attemptCount: attemptNumber,
      lastError: result.error,
    });

    logger.info(
      {
        requestId: row.id,
        attemptNumber,
        error: result.error,
        reason: isTerminal ? "non-retriable status" : "max retries exhausted",
      },
      "Request failed",
    );
    return;
  }

  const delay = computeDelay(attemptNumber, row.backoffMs);
  const nextRetryAt = Date.now() + delay;

  insertAttempt({
    requestId: row.id,
    attemptNumber,
    statusCode: result.statusCode,
    error: result.error,
    delay,
  });

  updateRequestStatus(row.id, {
    status: REQUEST_STATUS.RETRYING,
    attemptCount: attemptNumber,
    nextRetryAt,
    lastError: result.error,
  });

  logger.info(
    { requestId: row.id, attemptNumber, delay, nextRetryAt },
    "Request scheduled for retry",
  );
}
