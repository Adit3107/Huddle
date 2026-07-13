import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { logger } from "../utils/logger.js";
import { sendError } from "../utils/api-response.js";

export function notFoundHandler(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  next(
    new AppError(
      404,
      "ROUTE_NOT_FOUND",
      `Route ${request.method} ${request.originalUrl} was not found.`
    )
  );
}

export function globalErrorHandler(
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  void _next;

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logger.error({ err: error, path: request.originalUrl }, error.message);
    } else {
      logger.warn({ code: error.code, path: request.originalUrl }, error.message);
    }

    return sendError(response, error.statusCode, error.code, error.message);
  }

  logger.error({ err: error, path: request.originalUrl }, "Unhandled server error");

  return sendError(
    response,
    500,
    "INTERNAL_SERVER_ERROR",
    "Something went wrong."
  );
}
