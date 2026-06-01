process.env.DB_PATH = ":memory:";
process.env.NODE_ENV = "test";

import request from "supertest";
import app from "../../src/app.js";
import { createSchema } from "../../src/db/schema.js";
import { getDatabase } from "../../src/db/client.js";
import { insertRequest } from "../../src/db/requests.js";

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

describe("POST /request", () => {
  it("returns 201 with id and status", async () => {
    const res = await request(app)
      .post("/request")
      .send({ url: "https://example.com", method: "GET" })
      .expect(201);

    expect(res.body).toHaveProperty("id");
    expect(res.body.status).toBe("pending");
  });

  it("returns 400 for missing url", async () => {
    const res = await request(app).post("/request").send({ method: "GET" }).expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 for invalid method", async () => {
    const res = await request(app)
      .post("/request")
      .send({ url: "https://example.com", method: "FETCH" })
      .expect(400);

    expect(res.body).toHaveProperty("error");
  });

  it("returns 422 for maxRetries less than 1", async () => {
    const res = await request(app)
      .post("/request")
      .send({ url: "https://example.com", method: "GET", maxRetries: 0 })
      .expect(422);

    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /requests/:id", () => {
  it("returns the request with attempts", async () => {
    const row = insertRequest({ url: "https://example.com", method: "GET" });

    const res = await request(app).get(`/requests/${row.id}`).expect(200);

    expect(res.body.id).toBe(row.id);
    expect(res.body.attempts).toEqual([]);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app).get("/requests/nonexistent").expect(404);

    expect(res.body).toHaveProperty("error");
  });
});

describe("GET /requests", () => {
  it("returns all requests", async () => {
    insertRequest({ url: "https://a.com", method: "GET" });
    insertRequest({ url: "https://b.com", method: "POST" });

    const res = await request(app).get("/requests").expect(200);

    expect(res.body).toHaveLength(2);
  });

  it("filters by status", async () => {
    insertRequest({ url: "https://a.com", method: "GET" });

    const res = await request(app).get("/requests?status=pending").expect(200);

    expect(res.body).toHaveLength(1);
  });

  it("returns 400 for invalid status", async () => {
    const res = await request(app).get("/requests?status=invalid").expect(400);

    expect(res.body).toHaveProperty("error");
  });
});
