import { messagesQuerySchema, roomIdParamsSchema } from "@huddle/shared";
import { Router } from "express";
import { listMessagesController } from "../controllers/message.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const messageRoutes = Router();

messageRoutes.get(
  "/:roomId",
  optionalAuth,
  validate({ params: roomIdParamsSchema, query: messagesQuerySchema }),
  asyncHandler(listMessagesController)
);

export default messageRoutes;
