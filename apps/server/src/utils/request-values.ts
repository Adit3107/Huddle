import type { Request } from "express";

export function getParam(request: Request, name: string) {
  const value = request.params[name];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}
