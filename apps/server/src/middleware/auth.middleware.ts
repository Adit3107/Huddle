import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { verifyAuthToken } from "../services/jwt.service.js";

export function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const authorization = request.header("Authorization");

  if (!authorization) {
    return next(
      new AppError(401, "MISSING_TOKEN", "Authentication is required.")
    );
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(
      new AppError(401, "INVALID_TOKEN", "Invalid authentication token.")
    );
  }

  const verification = verifyAuthToken(token);

  if (!verification.success) {
    return next(
      new AppError(
      401,
      verification.code,
      verification.message
      )
    );
  }

  request.user = verification.user;

  return next();
}

export function optionalAuth(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const authorization = request.header("Authorization");

  if (!authorization) {
    return next();
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(
      new AppError(401, "INVALID_TOKEN", "Invalid authentication token.")
    );
  }

  const verification = verifyAuthToken(token);

  if (!verification.success) {
    return next(
      new AppError(401, verification.code, verification.message)
    );
  }

  request.user = verification.user;

  return next();
}
