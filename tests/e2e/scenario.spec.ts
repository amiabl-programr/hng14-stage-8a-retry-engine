process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import nock from "nock";
import request from "supertest";
import app from "../../src/app.js";
import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";

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

describe("end-to-end: submit, retry, complete", () => {
  it("full lifecycle: pending -> retrying -> completed", async () => {
    const scope = nock("https://svc.example.com")
      .post("/submit")
      .reply(500)
      .post("/submit")
      .reply(502)
      .post("/submit")
      .reply(200, { processed: true });

    const res = await request(app)
      .post("/request")
      .send({ url: "https://svc.example.com/submit", method: "POST", maxRetries: 3 })
      .expect(201);

    const { id } = res.body;

    const verify = async (expectedStatus: string, expectedAttempts: number) => {
      const res = await request(app).get(`/requests/${id}`).expect(200);
      expect(res.body.status).toBe(expectedStatus);
      expect(res.body.attempts).toHaveLength(expectedAttempts);
    };

    // Simulate worker ticks via direct executeRequest calls
    const { executeRequest } = await import("../../src/worker/executor.js");
    const { getRequest } = await import("../../src/db/requests.js");

    // Tick 1: first retry attempt (after initial attempt, now retrying)
    const row1 = getRequest(id);
    await executeRequest(row1!);

    // Simulate worker polling: getDueRequests picks up retrying rows with past nextRetryAt
    // Manually advance nextRetryAt to past to simulate time passing
    // (In real scenario, worker picks it up after backoff delay)
    await verify("retrying", 1);

    // Tick 2
    const row2 = getRequest(id);
    const { updateRequestStatus } = await import("../../src/db/requests.js");
    updateRequestStatus(id, { nextRetryAt: new Date(0).toISOString() });
    await executeRequest(row2!);
    await verify("retrying", 2);

    // Tick 3: final attempt succeeds
    const row3 = getRequest(id);
    updateRequestStatus(id, { nextRetryAt: new Date(0).toISOString() });
    await executeRequest(row3!);
    await verify("completed", 3);

    scope.done();
  });

  it("submits, exhausts retries, ends as failed", async () => {
    const scope = nock("https://svc.example.com").post("/submit").times(3).reply(500);

    const res = await request(app)
      .post("/request")
      .send({ url: "https://svc.example.com/submit", method: "POST", maxRetries: 3 })
      .expect(201);

    const { id } = res.body;

    const { executeRequest } = await import("../../src/worker/executor.js");
    const { getRequest, updateRequestStatus } = await import("../../src/db/requests.js");

    for (let i = 0; i < 3; i++) {
      const row = getRequest(id);
      updateRequestStatus(id, { nextRetryAt: new Date(0).toISOString() });
      await executeRequest(row!);
    }

    const final = await request(app).get(`/requests/${id}`).expect(200);
    expect(final.body.status).toBe("failed");
    expect(final.body.attempts).toHaveLength(3);

    scope.done();
  });
});
