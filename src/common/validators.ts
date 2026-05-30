import { StatusCodes } from "http-status-codes";
import { HTTP_METHODS } from "./types.js";
import type { CreateRequestPayload } from "./types.js";

export interface ValidationError {
  status: number;
  message: string;
}

export interface ValidationSuccess {
  payload: CreateRequestPayload;
}

export type ValidationResult = ValidationError | ValidationSuccess;

const MAX_RETRIES_CAP = 10;
const DEFAULT_BACKOFF_MS = 1000;

export function validateCreateRequest(body: Record<string, unknown>): ValidationResult {
  if (!body.url || typeof body.url !== "string") {
    return { status: StatusCodes.BAD_REQUEST, message: "url is required and must be a string" };
  }

  if (!body.method || typeof body.method !== "string") {
    return { status: StatusCodes.BAD_REQUEST, message: "method is required and must be a string" };
  }

  const method = body.method.toUpperCase();

  if (!HTTP_METHODS.includes(method as never)) {
    return {
      status: StatusCodes.BAD_REQUEST,
      message: `Invalid HTTP method "${body.method}". Allowed: ${HTTP_METHODS.join(", ")}`,
    };
  }

  try {
    new URL(body.url as string);
  } catch {
    return { status: StatusCodes.BAD_REQUEST, message: "url must be a valid, parseable URL" };
  }

  let parsedBody: unknown;
  if (body.body !== undefined) {
    if (typeof body.body === "string") {
      try {
        parsedBody = JSON.parse(body.body);
      } catch {
        return { status: StatusCodes.BAD_REQUEST, message: "body must be valid JSON" };
      }
    } else {
      parsedBody = body.body;
    }
  }

  let maxRetries = 5;
  if (body.maxRetries !== undefined) {
    if (typeof body.maxRetries !== "number" || !Number.isInteger(body.maxRetries)) {
      return { status: StatusCodes.UNPROCESSABLE_ENTITY, message: "maxRetries must be an integer" };
    }
    if (body.maxRetries < 1) {
      return { status: StatusCodes.UNPROCESSABLE_ENTITY, message: "maxRetries must be at least 1" };
    }
    maxRetries = Math.min(body.maxRetries, MAX_RETRIES_CAP);
  }

  let backoffMs = DEFAULT_BACKOFF_MS;
  if (body.backoffMs !== undefined) {
    if (typeof body.backoffMs !== "number" || body.backoffMs < 0) {
      return {
        status: StatusCodes.UNPROCESSABLE_ENTITY,
        message: "backoffMs must be a non-negative number",
      };
    }
    if (body.backoffMs === 0) {
      return {
        status: StatusCodes.UNPROCESSABLE_ENTITY,
        message: "backoffMs must be greater than 0",
      };
    }
    backoffMs = body.backoffMs;
  }

  return {
    payload: {
      url: body.url as string,
      method: method as CreateRequestPayload["method"],
      body: parsedBody,
      maxRetries,
      backoffMs,
    },
  };
}
