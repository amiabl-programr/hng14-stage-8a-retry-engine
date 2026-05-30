import { validateCreateRequest } from "../../src/common/validators.js";

describe("validateCreateRequest", () => {
  it("rejects missing url", () => {
    const result = validateCreateRequest({ method: "GET" });
    expect(result).toEqual({ status: 400, message: "url is required and must be a string" });
  });

  it("rejects missing method", () => {
    const result = validateCreateRequest({ url: "https://example.com" });
    expect(result).toEqual({ status: 400, message: "method is required and must be a string" });
  });

  it("rejects invalid HTTP method", () => {
    const result = validateCreateRequest({ url: "https://example.com", method: "FETCH" });
    expect(result).toEqual({
      status: 400,
      message: 'Invalid HTTP method "FETCH". Allowed: GET, POST, PUT, PATCH, DELETE',
    });
  });

  it("rejects malformed URL", () => {
    const result = validateCreateRequest({ url: "not-a-url", method: "GET" });
    expect(result).toEqual({ status: 400, message: "url must be a valid, parseable URL" });
  });

  it("rejects maxRetries less than 1", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "GET",
      maxRetries: 0,
    });
    expect(result).toEqual({ status: 422, message: "maxRetries must be at least 1" });
  });

  it("rejects non-integer maxRetries", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "GET",
      maxRetries: 1.5,
    });
    expect(result).toEqual({ status: 422, message: "maxRetries must be an integer" });
  });

  it("clamps maxRetries above 10", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "GET",
      maxRetries: 20,
    });
    expect("payload" in result && result.payload.maxRetries).toBe(10);
  });

  it("rejects backoffMs of 0", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "GET",
      backoffMs: 0,
    });
    expect(result).toEqual({ status: 422, message: "backoffMs must be greater than 0" });
  });

  it("rejects negative backoffMs", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "GET",
      backoffMs: -1,
    });
    expect(result).toEqual({ status: 422, message: "backoffMs must be a non-negative number" });
  });

  it("accepts valid payload with defaults", () => {
    const result = validateCreateRequest({ url: "https://example.com", method: "POST" });
    expect("payload" in result).toBe(true);
    if ("payload" in result) {
      expect(result.payload.url).toBe("https://example.com");
      expect(result.payload.method).toBe("POST");
      expect(result.payload.maxRetries).toBe(5);
      expect(result.payload.backoffMs).toBe(1000);
    }
  });

  it("accepts body as object", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "POST",
      body: { key: "value" },
    });
    expect("payload" in result).toBe(true);
  });

  it("rejects invalid JSON string body", () => {
    const result = validateCreateRequest({
      url: "https://example.com",
      method: "POST",
      body: "{invalid}",
    });
    expect(result).toEqual({ status: 400, message: "body must be valid JSON" });
  });
});
