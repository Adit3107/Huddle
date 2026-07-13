import { identityLoginSchema } from "@huddle/shared";
import { Router } from "express";
import { loginWithIdentity } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const authRoutes = Router();

authRoutes.post(
  "/login",
  validate({ body: identityLoginSchema }),
  asyncHandler(loginWithIdentity)
);

export default authRoutes;
