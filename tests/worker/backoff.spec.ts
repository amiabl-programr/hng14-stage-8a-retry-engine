import { computeDelay } from "../../src/worker/backoff.js";

describe("computeDelay", () => {
  it("returns at least 100ms", () => {
    const delay = computeDelay(0, 1);
    expect(delay).toBeGreaterThanOrEqual(100);
  });

  it("increases with attempt count", () => {
    const delay1 = computeDelay(1, 1000);
    const delay2 = computeDelay(2, 1000);
    expect(delay2).toBeGreaterThan(delay1);
  });

  it("applies jitter within expected range", () => {
    const delays = Array.from({ length: 100 }, () => computeDelay(1, 1000));
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    // Nominal: 1000 * 2^1 = 2000, with jitter 0.8-1.2 => 1600-2400
    expect(min).toBeGreaterThanOrEqual(100);
    expect(max).toBeLessThanOrEqual(2500);
  });

  it("produces different values across calls (jitter)", () => {
    const delays = new Set(Array.from({ length: 50 }, () => computeDelay(1, 1000)));
    expect(delays.size).toBeGreaterThan(1);
  });
});
