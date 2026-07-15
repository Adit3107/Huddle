import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import {
  deleteIdentityUser,
  upsertIdentityUser
} from "../services/user.service.js";
import { sendSuccess } from "../utils/api-response.js";

interface ClerkEmailAddress {
  email_address?: string;
  id: string;
}

interface ClerkUserPayload {
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  id: string;
  image_url?: string | null;
  last_name?: string | null;
  primary_email_address_id?: string | null;
  profile_image_url?: string | null;
  username?: string | null;
}

interface ClerkWebhookEvent {
  data: ClerkUserPayload;
  type: "user.created" | "user.updated" | "user.deleted" | string;
}

function getHeaderValue(request: Request, name: string) {
  const value = request.headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
}

function verifyClerkSignature(request: Request, rawBody: Buffer) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    throw new AppError(
      500,
      "CLERK_WEBHOOK_SECRET_MISSING",
      "Clerk webhook secret is not configured."
    );
  }

  const id = getHeaderValue(request, "svix-id");
  const timestamp = getHeaderValue(request, "svix-timestamp");
  const signature = getHeaderValue(request, "svix-signature");

  if (!id || !timestamp || !signature) {
    throw new AppError(400, "INVALID_WEBHOOK_HEADERS", "Missing Svix headers.");
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody.toString("utf8")}`;
  const expected = createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest();

  const signatures = signature
    .split(" ")
    .flatMap((part) => part.split(","))
    .filter((part) => part && part !== "v1");

  const isValid = signatures.some((candidate) => {
    const candidateBytes = Buffer.from(candidate, "base64");

    return (
      candidateBytes.length === expected.length &&
      timingSafeEqual(candidateBytes, expected)
    );
  });

  if (!isValid) {
    throw new AppError(
      400,
      "INVALID_WEBHOOK_SIGNATURE",
      "Clerk webhook signature verification failed."
    );
  }
}

function primaryEmail(user: ClerkUserPayload) {
  const primary = user.email_addresses?.find(
    (email) => email.id === user.primary_email_address_id
  );

  return primary?.email_address ?? user.email_addresses?.[0]?.email_address;
}

function displayName(user: ClerkUserPayload, email: string) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");

  return name || user.username || email;
}

export async function handleClerkWebhook(request: Request, response: Response) {
  if (!Buffer.isBuffer(request.body)) {
    throw new AppError(400, "INVALID_WEBHOOK_BODY", "Expected a raw body.");
  }

  verifyClerkSignature(request, request.body);

  const event = JSON.parse(request.body.toString("utf8")) as ClerkWebhookEvent;

  if (event.type === "user.deleted") {
    await deleteIdentityUser(event.data.id);
    return sendSuccess(response, { received: true });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const email = primaryEmail(event.data);

    if (!email) {
      throw new AppError(
        400,
        "CLERK_EMAIL_MISSING",
        "Clerk user payload did not include an email address."
      );
    }

    await upsertIdentityUser({
      email,
      image: event.data.image_url ?? event.data.profile_image_url ?? null,
      name: displayName(event.data, email),
      providerId: event.data.id
    });
  }

  return sendSuccess(response, { received: true });
}
