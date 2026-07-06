import type { Response } from "express";

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export function sendSuccess<T>(
  response: Response,
  data: T,
  statusCode = 200
) {
  return response.status(statusCode).json({
    success: true,
    data
  } satisfies ApiSuccessResponse<T>);
}

export function sendError(
  response: Response,
  statusCode: number,
  code: string,
  message: string
) {
  return response.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  } satisfies ApiErrorResponse);
}
