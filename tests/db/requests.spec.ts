process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";
import {
  insertRequest,
  getRequest,
  listRequests,
  getDueRequests,
  updateRequestStatus,
} from "../../src/db/requests.js";
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

describe("insertRequest", () => {
  it("creates a request with defaults", () => {
    const row = insertRequest({ url: "https://example.com", method: "GET" });
    expect(row.id).toBeDefined();
    expect(row.url).toBe("https://example.com");
    expect(row.method).toBe("GET");
    expect(row.status).toBe(REQUEST_STATUS.PENDING);
    expect(row.maxRetries).toBe(5);
    expect(row.backoffMs).toBe(1000);
    expect(row.attemptCount).toBe(0);
  });

  it("accepts custom maxRetries and backoffMs", () => {
    const row = insertRequest({
      url: "https://example.com",
      method: "POST",
      maxRetries: 3,
      backoffMs: 2000,
    });
    expect(row.maxRetries).toBe(3);
    expect(row.backoffMs).toBe(2000);
  });

  it("stores JSON body as string", () => {
    const row = insertRequest({ url: "https://example.com", method: "POST", body: { foo: "bar" } });
    expect(row.body).toBe('{"foo":"bar"}');
  });
});

describe("getRequest", () => {
  it("returns request by id", () => {
    const created = insertRequest({ url: "https://example.com", method: "GET" });
    const found = getRequest(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
  });

  it("returns undefined for non-existent id", () => {
    expect(getRequest("nonexistent")).toBeUndefined();
  });
});

describe("listRequests", () => {
  it("returns all requests", () => {
    insertRequest({ url: "https://a.com", method: "GET" });
    insertRequest({ url: "https://b.com", method: "POST" });
    const rows = listRequests();
    expect(rows).toHaveLength(2);
  });

  it("filters by status", () => {
    insertRequest({ url: "https://a.com", method: "GET" });
    const pending = listRequests(REQUEST_STATUS.PENDING);
    const completed = listRequests(REQUEST_STATUS.COMPLETED);
    expect(pending).toHaveLength(1);
    expect(completed).toHaveLength(0);
  });
});

describe("getDueRequests", () => {
  it("returns pending requests with past nextRetryAt", () => {
    insertRequest({ url: "https://a.com", method: "GET" });
    const due = getDueRequests(new Date(Date.now() + 10000).toISOString());
    expect(due).toHaveLength(1);
  });

  it("excludes requests with future nextRetryAt", () => {
    const row = insertRequest({ url: "https://a.com", method: "GET" });
    updateRequestStatus(row.id, {
      nextRetryAt: new Date(Date.now() + 60000).toISOString(),
      status: REQUEST_STATUS.RETRYING,
    });
    const due = getDueRequests(new Date().toISOString());
    expect(due).toHaveLength(0);
  });

  it("returns due requests ordered by nextRetryAt (earliest first)", () => {
    const r3 = insertRequest({ url: "https://c.com", method: "GET" });
    const r1 = insertRequest({ url: "https://a.com", method: "GET" });
    const r2 = insertRequest({ url: "https://b.com", method: "GET" });

    // Manually set nextRetryAt to specific orders
    updateRequestStatus(r3.id, { nextRetryAt: new Date(3000).toISOString() });
    updateRequestStatus(r1.id, { nextRetryAt: new Date(1000).toISOString() });
    updateRequestStatus(r2.id, { nextRetryAt: new Date(2000).toISOString() });

    const due = getDueRequests(new Date(5000).toISOString());
    expect(due).toHaveLength(3);
    expect(due[0].id).toBe(r1.id);
    expect(due[1].id).toBe(r2.id);
    expect(due[2].id).toBe(r3.id);
  });

  it("returns both pending and retrying requests that are due", () => {
    const pending = insertRequest({ url: "https://a.com", method: "GET" });
    const retrying = insertRequest({ url: "https://b.com", method: "POST" });
    updateRequestStatus(retrying.id, { status: REQUEST_STATUS.RETRYING, nextRetryAt: new Date(0).toISOString() });

    const due = getDueRequests(new Date(Date.now() + 10000).toISOString());
    expect(due).toHaveLength(2);
  });
});
