process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import nock from "nock";
import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";
import { insertRequest, getRequest } from "../../src/db/requests.js";
import { getAttemptsByRequestId } from "../../src/db/attempts.js";
import { executeRequest } from "../../src/worker/executor.js";
import { REQUEST_STATUS } from "../../src/common/types.js";

beforeAll(() => {
  createSchema(getDatabase());
});

beforeEach(() => {
  const db = getDatabase();
  db.exec("DELETE FROM requests");
  db.exec("DELETE FROM attempts");
});

afterAll(() => {
  getDatabase().close();
});

afterEach(() => {
  nock.cleanAll();
});

describe("executeRequest", () => {
  it("marks request as completed on 2xx", async () => {
    const scope = nock("https://httpbin.org").post("/post").reply(200, { ok: true });

    const row = insertRequest({ url: "https://httpbin.org/post", method: "POST" });
    await executeRequest(row);

    const updated = getRequest(row.id);
    expect(updated!.status).toBe(REQUEST_STATUS.COMPLETED);

    const attempts = getAttemptsByRequestId(row.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].statusCode).toBe(200);

    scope.done();
  });

  it("marks request as failed on non-retriable 4xx", async () => {
    const scope = nock("https://httpbin.org").get("/status/400").reply(400);

    const row = insertRequest({ url: "https://httpbin.org/status/400", method: "GET" });
    await executeRequest(row);

    const updated = getRequest(row.id);
    expect(updated!.status).toBe(REQUEST_STATUS.FAILED);

    scope.done();
  });

  it("marks request as retrying on 5xx within maxRetries", async () => {
    const scope = nock("https://httpbin.org").get("/status/500").reply(500);

    const row = insertRequest({
      url: "https://httpbin.org/status/500",
      method: "GET",
      maxRetries: 3,
    });
    await executeRequest(row);

    const updated = getRequest(row.id);
    expect(updated!.status).toBe(REQUEST_STATUS.RETRYING);
    expect(updated!.attemptCount).toBe(1);

    const attempts = getAttemptsByRequestId(row.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].statusCode).toBe(500);

    scope.done();
  });

  it("fails request after exhausting maxRetries", async () => {
    const scope = nock("https://httpbin.org").get("/status/500").times(3).reply(500);

    const row = insertRequest({
      url: "https://httpbin.org/status/500",
      method: "GET",
      maxRetries: 3,
    });

    await executeRequest(row);
    expect(getRequest(row.id)!.status).toBe(REQUEST_STATUS.RETRYING);

    await executeRequest(getRequest(row.id)!);
    expect(getRequest(row.id)!.status).toBe(REQUEST_STATUS.RETRYING);

    await executeRequest(getRequest(row.id)!);
    expect(getRequest(row.id)!.status).toBe(REQUEST_STATUS.FAILED);

    scope.done();
  });

  it("handles network errors gracefully", async () => {
    const scope = nock("https://httpbin.org").get("/timeout").replyWithError("ETIMEDOUT");

    const row = insertRequest({ url: "https://httpbin.org/timeout", method: "GET" });
    await executeRequest(row);

    const updated = getRequest(row.id);
    expect(updated!.status).toBe(REQUEST_STATUS.RETRYING);
    expect(updated!.lastError).toContain("Network error");

    scope.done();
  });

  it("records attempt history for each execution", async () => {
    const scope = nock("https://httpbin.org").get("/status/500").reply(500);

    const row = insertRequest({
      url: "https://httpbin.org/status/500",
      method: "GET",
      maxRetries: 5,
    });
    await executeRequest(row);

    const attempts = getAttemptsByRequestId(row.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[0].statusCode).toBe(500);
    expect(attempts[0].delay).toBeGreaterThan(0);

    scope.done();
  });
});
