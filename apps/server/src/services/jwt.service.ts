import jwt from "jsonwebtoken";
import type { AuthenticatedUser, JwtPayload } from "../types/auth.js";

const JWT_EXPIRES_IN = "7d";
const { JsonWebTokenError, TokenExpiredError } = jwt;

export type JwtVerificationResult =
  | {
      success: true;
      user: AuthenticatedUser;
    }
  | {
      success: false;
      code: "TOKEN_EXPIRED" | "INVALID_TOKEN";
      message: string;
    };

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is required.");
  }

  return secret;
}

export function signAuthToken(user: AuthenticatedUser) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    getJwtSecret(),
    {
      expiresIn: JWT_EXPIRES_IN
    }
  );
}

export function verifyAuthToken(token: string): JwtVerificationResult {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;

    if (
      typeof payload.id !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string"
    ) {
      return {
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid authentication token."
      };
    }

    return {
      success: true,
      user: {
        id: payload.id,
        email: payload.email,
        name: payload.name
      }
    };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return {
        success: false,
        code: "TOKEN_EXPIRED",
        message: "Authentication token has expired."
      };
    }

    if (error instanceof JsonWebTokenError) {
      return {
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid authentication token."
      };
    }

    throw error;
  }
}
