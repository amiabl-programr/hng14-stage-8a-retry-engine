import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import {
  createRequest,
  getRequestWithAttempts,
  listRequestsByStatus,
} from "../service/request.service.js";

export function postRequest(req: Request, res: Response): void {
  try {
    const result = createRequest(req.body);
    res.status(StatusCodes.CREATED).json(result);
  } catch (err) {
    const error = err as { status: number; message: string };
    res.status(error.status).json({ error: error.message });
  }
}

export function getRequestById(req: Request, res: Response): void {
  const id = req.params["id"] as string;
  const result = getRequestWithAttempts(id);

  if (!result) {
    res.status(StatusCodes.NOT_FOUND).json({ error: "Request not found" });
    return;
  }

    res.status(StatusCodes.OK).json({ ...result.request, attempts: result.attempts });
}

export function getRequests(req: Request, res: Response): void {
  const status = req.query["status"] as string | undefined;

  try {
    const result = listRequestsByStatus(status);
    res.status(StatusCodes.OK).json(result.requests);
  } catch (err) {
    const error = err as { status: number; message: string };
    res.status(error.status).json({ error: error.message });
  }
}
