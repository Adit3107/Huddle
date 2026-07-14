import type { RealtimeMessage, RealtimeParticipant } from "@huddle/shared";
import prisma from "../config/prisma.js";
import { AppError } from "../errors/app-error.js";
import { verifyAuthToken } from "../services/jwt.service.js";
import { assertRoomAccess, getRoomOrThrow } from "../services/room.service.js";

interface SocketIdentityInput {
  authorization?: string;
  token?: string;
}

export interface SocketIdentity {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

function extractBearerToken(authorization?: string) {
  if (!authorization) {
    return undefined;
  }

  const [scheme, token] = authorization.split(" ");
  return scheme === "Bearer" ? token : undefined;
}

export function resolveSocketIdentity(input: SocketIdentityInput) {
  const token = input.token ?? extractBearerToken(input.authorization);

  if (!token) {
    return {};
  }

  const verification = verifyAuthToken(token);

  if (!verification.success) {
    throw new AppError(401, verification.code, verification.message);
  }

  return {
    user: verification.user
  };
}

export async function resolveRoomParticipant(
  roomId: string,
  options: {
    userId?: string;
    email?: string;
    participantId?: string;
  }
): Promise<RealtimeParticipant> {
  await assertRoomAccess(roomId, options);

  const participant = options.participantId
    ? await prisma.groupUser.findFirst({
        where: {
          id: options.participantId,
          groupId: roomId
        },
        select: {
          id: true,
          userId: true,
          displayName: true,
          isAnonymous: true
        }
      })
    : options.userId
      ? await prisma.groupUser.findUnique({
          where: {
            groupId_userId: {
              groupId: roomId,
              userId: options.userId
            }
          },
          select: {
            id: true,
            userId: true,
            displayName: true,
            isAnonymous: true
          }
        })
      : options.email
        ? await prisma.groupUser.findFirst({
            where: {
              groupId: roomId,
              user: {
                email: options.email
              }
            },
            select: {
              id: true,
              userId: true,
              displayName: true,
              isAnonymous: true
            }
          })
      : null;

  if (!participant) {
    throw new AppError(
      403,
      "ROOM_ACCESS_DENIED",
      "Room participant is required."
    );
  }

  return {
    participantId: participant.id,
    userId: participant.userId,
    displayName: participant.displayName,
    isAnonymous: participant.isAnonymous
  };
}

export async function ensureRoomIsActive(roomId: string) {
  return getRoomOrThrow(roomId);
}

export async function listMissedMessages(
  roomId: string,
  options: {
    since?: string;
    lastMessageId?: string;
  }
): Promise<RealtimeMessage[]> {
  const cursorMessage = options.lastMessageId
    ? await prisma.message.findFirst({
        where: {
          id: options.lastMessageId,
          groupId: roomId
        },
        select: {
          createdAt: true
        }
      })
    : null;

  const sinceDate = options.since
    ? new Date(options.since)
    : cursorMessage?.createdAt;

  if (!sinceDate) {
    return [];
  }

  const messages = await prisma.message.findMany({
    where: {
      groupId: roomId,
      createdAt: {
        gt: sinceDate
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    take: 100,
    select: {
      id: true,
      groupId: true,
      senderId: true,
      senderName: true,
      text: true,
      fileUrl: true,
      fileType: true,
      fileName: true,
      createdAt: true,
      sender: {
        select: {
          userId: true,
          isAnonymous: true
        }
      }
    }
  });

  return messages.map((message) => ({
    id: message.id,
    roomId: message.groupId,
    sender: {
      participantId: message.senderId,
      userId: message.sender.userId,
      displayName: message.senderName,
      isAnonymous: message.sender.isAnonymous
    },
    kind: message.fileUrl
      ? message.fileType?.startsWith("image/")
        ? "IMAGE"
        : "FILE"
      : "TEXT",
    text: message.text,
    fileUrl: message.fileUrl,
    fileType: message.fileType,
    fileName: message.fileName,
    createdAt: message.createdAt.toISOString(),
    status: "persisted"
  }));
}
