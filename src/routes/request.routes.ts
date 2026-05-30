import { Router } from "express";
import type { Router as RouterType } from "express";
import { postRequest, getRequestById, getRequests } from "../controllers/request.controller.js";

const router: RouterType = Router();

router.post("/request", postRequest);
router.get("/requests/:id", getRequestById);
router.get("/requests", getRequests);

export default router;
