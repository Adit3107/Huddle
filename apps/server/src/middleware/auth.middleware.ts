import type { NextFunction, Request, Response } from "express";
import { verifyAuthToken } from "../services/jwt.service.js";
import { sendError } from "../utils/api-response.js";

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const authorization = request.header("Authorization");

  if (!authorization) {
    return sendError(response, 401, "MISSING_TOKEN", "Authentication is required.");
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return sendError(response, 401, "INVALID_TOKEN", "Invalid authentication token.");
  }

  const verification = verifyAuthToken(token);

  if (!verification.success) {
    return sendError(
      response,
      401,
      verification.code,
      verification.message
    );
  }

  request.user = verification.user;

  return next();
}
