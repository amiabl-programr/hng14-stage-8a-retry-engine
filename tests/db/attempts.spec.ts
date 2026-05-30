process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";
import { insertRequest } from "../../src/db/requests.js";
import { insertAttempt, getAttemptsByRequestId } from "../../src/db/attempts.js";
import { REQUEST_STATUS } from "../../src/common/types.js";

beforeAll(() => {
  createSchema(getDatabase());
});

afterAll(() => {
  getDatabase().close();
});

beforeEach(() => {
  const db = getDatabase();
  db.exec("DELETE FROM requests");
  db.exec("DELETE FROM attempts");
});

describe("insertAttempt", () => {
  it("creates an attempt record for a request", () => {
    const request = insertRequest({ url: "https://example.com", method: "GET" });

    insertAttempt({
      requestId: request.id,
      attemptNumber: 1,
      statusCode: 200,
      error: null,
      delay: 0,
    });

    const attempts = getAttemptsByRequestId(request.id);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[0].statusCode).toBe(200);
  });

  it("stores error information", () => {
    const request = insertRequest({ url: "https://example.com", method: "GET" });

    insertAttempt({
      requestId: request.id,
      attemptNumber: 1,
      statusCode: 500,
      error: "HTTP 500",
      delay: 1000,
    });

    const attempts = getAttemptsByRequestId(request.id);
    expect(attempts[0].error).toBe("HTTP 500");
    expect(attempts[0].delay).toBe(1000);
  });

  it("returns attempts ordered by attemptNumber", () => {
    const request = insertRequest({ url: "https://example.com", method: "GET" });

    insertAttempt({
      requestId: request.id,
      attemptNumber: 2,
      statusCode: null,
      error: "timeout",
      delay: 2000,
    });
    insertAttempt({
      requestId: request.id,
      attemptNumber: 1,
      statusCode: 500,
      error: "HTTP 500",
      delay: 1000,
    });

    const attempts = getAttemptsByRequestId(request.id);
    expect(attempts).toHaveLength(2);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[1].attemptNumber).toBe(2);
  });
});
