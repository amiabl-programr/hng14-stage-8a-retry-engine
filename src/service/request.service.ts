import { insertRequest, getRequest, listRequests } from "../db/requests.js";
import { getAttemptsByRequestId } from "../db/attempts.js";
import { validateCreateRequest } from "../common/validators.js";
import { StatusCodes } from "http-status-codes";
import { REQUEST_STATUS } from "../common/types.js";
import type { CreateRequestPayload, RequestRow, AttemptRow } from "../common/types.js";

export interface CreateRequestResult {
  id: string;
  status: string;
}

export interface GetRequestResult {
  request: RequestRow;
  attempts: AttemptRow[];
}

export interface ListRequestsResult {
  requests: RequestRow[];
}

export function createRequest(body: Record<string, unknown>): CreateRequestResult {
  const validation = validateCreateRequest(body);

  if ("status" in validation) {
    throw validation;
  }

  const row = insertRequest(validation.payload as CreateRequestPayload);
  return { id: row.id, status: row.status };
}

export function getRequestWithAttempts(id: string): GetRequestResult | null {
  const request = getRequest(id);

  if (!request) return null;

  const attempts = getAttemptsByRequestId(id);
  return { request, attempts };
}

export function listRequestsByStatus(status?: string): ListRequestsResult {
  if (status !== undefined) {
    const validStatuses = Object.values(REQUEST_STATUS);
    if (!validStatuses.includes(status as never)) {
      throw {
        status: StatusCodes.BAD_REQUEST,
        message: `Invalid status "${status}". Valid: ${validStatuses.join(", ")}`,
      };
    }
  }

  const requests = listRequests(status);
  return { requests };
}
