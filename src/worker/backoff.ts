const MIN_DELAY_MS = 100;
const JITTER_MIN = 0.8;
const JITTER_MAX = 1.2;

export function computeDelay(attemptCount: number, backoffMs: number): number {
  const jitter = Math.random() * (JITTER_MAX - JITTER_MIN) + JITTER_MIN;
  const delay = backoffMs * Math.pow(2, attemptCount) * jitter;
  return Math.max(MIN_DELAY_MS, Math.round(delay));
}
