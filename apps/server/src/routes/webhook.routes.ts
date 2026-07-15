import { Router } from "express";
import { handleClerkWebhook } from "../controllers/clerk-webhook.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

const webhookRoutes = Router();

webhookRoutes.post("/clerk", asyncHandler(handleClerkWebhook));

export default webhookRoutes;
