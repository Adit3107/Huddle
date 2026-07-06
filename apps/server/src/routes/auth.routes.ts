import { googleLoginSchema } from "@huddle/shared";
import { Router } from "express";
import { loginWithGoogle } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const authRoutes = Router();

authRoutes.post(
  "/login",
  validate({ body: googleLoginSchema }),
  asyncHandler(loginWithGoogle)
);

export default authRoutes;
