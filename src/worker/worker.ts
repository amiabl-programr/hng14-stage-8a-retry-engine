import logger from "../config/logger.js";
import { getDueRequests } from "../db/requests.js";
import { executeRequest } from "./executor.js";

const POLL_INTERVAL_MS = 500;

let intervalId: ReturnType<typeof setInterval> | undefined;

export function startWorker(): void {
  if (intervalId) return;

  logger.info("Worker started");

  intervalId = setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const rows = getDueRequests(now);

      if (rows.length === 0) return;

      logger.info({ count: rows.length }, "Worker processing due requests");
      await Promise.allSettled(rows.map((row) => executeRequest(row)));
    } catch (err) {
      logger.error({ err }, "Worker tick failed");
    }
  }, POLL_INTERVAL_MS);
}

export function stopWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = undefined;
    logger.info("Worker stopped");
  }
}
