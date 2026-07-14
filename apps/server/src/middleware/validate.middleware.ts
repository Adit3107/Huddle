import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { AppError } from "../errors/app-error.js";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (request: Request, _response: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }

      if (schemas.params) {
        request.params = schemas.params.parse(request.params) as Record<
          string,
          string
        >;
      }

      if (schemas.query) {
        Object.defineProperty(request, "query", {
          value: schemas.query.parse(request.query) as Request["query"],
          writable: true,
          configurable: true,
          enumerable: true
        });
      }

      next();
    } catch (error) {
      next(
        new AppError(
          400,
          "VALIDATION_FAILED",
          error instanceof Error ? error.message : "Request validation failed."
        )
      );
    }
  };
}
