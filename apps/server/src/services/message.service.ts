import prisma from "../config/prisma.js";
import { AppError } from "../errors/app-error.js";
import { assertRoomAccess } from "./room.service.js";

export async function listMessages(
  roomId: string,
  options: {
    userId?: string;
    participantId?: string;
    cursor?: string;
    limit: number;
  }
) {
  await assertRoomAccess(roomId, {
    userId: options.userId,
    participantId: options.participantId
  });

  if (options.cursor) {
    const cursorMessage = await prisma.message.findFirst({
      where: {
        id: options.cursor,
        groupId: roomId
      },
      select: {
        id: true
      }
    });

    if (!cursorMessage) {
      throw new AppError(400, "INVALID_CURSOR", "Message cursor is invalid.");
    }
  }

  const messages = await prisma.message.findMany({
    where: {
      groupId: roomId
    },
    orderBy: [
      {
        createdAt: "desc"
      },
      {
        id: "desc"
      }
    ],
    ...(options.cursor
      ? {
          cursor: {
            id: options.cursor
          },
          skip: 1
        }
      : {}),
    take: options.limit + 1,
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
      updatedAt: true
    }
  });

  const hasMore = messages.length > options.limit;
  const items = hasMore ? messages.slice(0, options.limit) : messages;
  const nextCursor = hasMore ? items.at(-1)?.id ?? null : null;

  return {
    items,
    meta: {
      limit: options.limit,
      nextCursor,
      hasMore
    }
  };
}
