import type { Request, Response } from "express";
import { signAuthToken } from "../services/jwt.service.js";
import { DuplicateUserError, upsertGoogleUser } from "../services/user.service.js";
import type {
  GoogleLoginPayload,
  ValidGoogleLoginPayload
} from "../types/auth.js";
import { sendError, sendSuccess } from "../utils/api-response.js";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validateGooglePayload(
  payload: GoogleLoginPayload
): ValidGoogleLoginPayload | null {
  const email = normalizeText(payload.email).toLowerCase();
  const name = normalizeText(payload.name);
  const providerId = normalizeText(payload.providerId);
  const image =
    typeof payload.image === "string" && payload.image.trim().length > 0
      ? payload.image.trim()
      : null;

  if (!email || !name || !providerId) {
    return null;
  }

  return {
    email,
    name,
    image,
    providerId
  };
}

export async function loginWithGoogle(
  request: Request<unknown, unknown, GoogleLoginPayload>,
  response: Response
) {
  try {
    const profile = validateGooglePayload(request.body);

    if (!profile) {
      return sendError(
        response,
        400,
        "INVALID_GOOGLE_PAYLOAD",
        "Google profile payload is invalid."
      );
    }

    const user = await upsertGoogleUser(profile);
    const token = signAuthToken(user);

    return sendSuccess(response, {
      user,
      token
    });
  } catch (error) {
    if (error instanceof DuplicateUserError) {
      return sendError(response, 409, "DUPLICATE_USER", error.message);
    }

    console.error("Google login failed", error);

    return sendError(
      response,
      500,
      "AUTH_LOGIN_FAILED",
      "Unable to complete login."
    );
  }
}
