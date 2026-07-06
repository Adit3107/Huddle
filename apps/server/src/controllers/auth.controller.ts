import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { signAuthToken } from "../services/jwt.service.js";
import { DuplicateUserError, upsertGoogleUser } from "../services/user.service.js";
import type { ValidGoogleLoginPayload } from "../types/auth.js";
import { sendSuccess } from "../utils/api-response.js";

export async function loginWithGoogle(
  request: Request<unknown, unknown, ValidGoogleLoginPayload>,
  response: Response
) {
  try {
    const user = await upsertGoogleUser(request.body);
    const token = signAuthToken(user);

    return sendSuccess(response, {
      user,
      token
    });
  } catch (error) {
    if (error instanceof DuplicateUserError) {
      throw new AppError(409, "DUPLICATE_USER", error.message);
    }

    throw error;
  }
}
