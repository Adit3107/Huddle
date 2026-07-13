import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import { signAuthToken } from "../services/jwt.service.js";
import { DuplicateUserError, upsertIdentityUser } from "../services/user.service.js";
import type { ValidIdentityLoginPayload } from "../types/auth.js";
import { sendSuccess } from "../utils/api-response.js";

export async function loginWithIdentity(
  request: Request<unknown, unknown, ValidIdentityLoginPayload>,
  response: Response
) {
  try {
    const user = await upsertIdentityUser(request.body);
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
