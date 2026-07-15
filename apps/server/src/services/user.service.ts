import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import type {
  AuthenticatedUserResponse,
  ValidIdentityLoginPayload
} from "../types/auth.js";

export class DuplicateUserError extends Error {
  constructor() {
    super("A user with this email or identity account already exists.");
    this.name = "DuplicateUserError";
  }
}

export async function upsertIdentityUser(
  profile: ValidIdentityLoginPayload
): Promise<AuthenticatedUserResponse> {
  try {
    const user = await prisma.user.upsert({
      where: {
        email: profile.email
      },
      create: {
        email: profile.email,
        name: profile.name,
        image: profile.image,
        provider: "clerk",
        providerId: profile.providerId
      },
      update: {
        name: profile.name,
        image: profile.image,
        provider: "clerk",
        providerId: profile.providerId
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true
      }
    });

    return user;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateUserError();
    }

    throw error;
  }
}

export async function deleteIdentityUser(providerId: string) {
  try {
    await prisma.user.delete({
      where: {
        provider_providerId: {
          provider: "clerk",
          providerId
        }
      }
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      await prisma.user.update({
        where: {
          provider_providerId: {
            provider: "clerk",
            providerId
          }
        },
        data: {
          email: `deleted-${providerId}@huddle.local`,
          image: null,
          name: "Deleted HUDDLE user",
          provider: "clerk_deleted",
          providerId
        }
      });
      return;
    }

    throw error;
  }
}
