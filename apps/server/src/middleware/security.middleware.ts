import type { NextFunction, Request, Response } from "express";

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    const sanitized: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(value)) {
      if (!BLOCKED_KEYS.has(key)) {
        sanitized[key] = sanitizeValue(childValue);
      }
    }

    return sanitized;
  }

  if (typeof value === "string") {
    return value.replace(/\0/g, "").trim();
  }

  return value;
}

export function sanitizeInput(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  request.body = sanitizeValue(request.body);
  request.params = sanitizeValue(request.params) as Request["params"];
  request.query = sanitizeValue(request.query) as Request["query"];
  next();
}
