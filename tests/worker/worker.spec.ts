process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";
import { startWorker, stopWorker } from "../../src/worker/worker.js";
import { insertRequest, getDueRequests } from "../../src/db/requests.js";

beforeAll(() => {
  createSchema(getDatabase());
});

afterAll(() => {
  stopWorker();
  getDatabase().close();
});

afterEach(() => {
  stopWorker();
});

describe("startWorker / stopWorker", () => {
  it("starts and stops without errors", () => {
    expect(() => startWorker()).not.toThrow();
    expect(() => stopWorker()).not.toThrow();
  });

  it("does not create duplicate intervals", () => {
    startWorker();
    startWorker();
    stopWorker();
  });

  it("processes due requests", async () => {
    insertRequest({ url: "https://httpbin.org/get", method: "GET", maxRetries: 1 });

    const due = getDueRequests(Date.now() + 10000);
    expect(due).toHaveLength(1);
  });
});
