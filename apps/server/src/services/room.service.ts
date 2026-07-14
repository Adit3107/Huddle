import { Prisma, RoomType } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../errors/app-error.js";

interface RoomInput {
  title: string;
  roomType: "QUICK" | "GROUP";
  description?: string | null;
  expiresAt?: Date | null;
  passcode: string;
}

interface UpdateRoomInput {
  title?: string;
  description?: string | null;
  expiresAt?: Date | null;
  passcode?: string | null;
}

interface JoinRoomInput {
  displayName?: string;
  isAnonymous: boolean;
  passcode?: string;
}

const roomSelect = {
  id: true,
  title: true,
  roomType: true,
  description: true,
  expiresAt: true,
  passcode: true,
  createdBy: true,
  owner: {
    select: {
      id: true,
      email: true,
      name: true,
      image: true
    }
  },
  peakUsers: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      members: true,
      messages: true
    }
  }
} satisfies Prisma.ChatGroupSelect;

type SelectedRoom = Prisma.ChatGroupGetPayload<{
  select: typeof roomSelect;
}>;

function ensureActiveRoom(room: {
  isArchived: boolean;
  roomType: RoomType;
  expiresAt: Date | null;
}) {
  if (room.isArchived) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  if (
    room.roomType !== "GROUP" &&
    room.expiresAt &&
    room.expiresAt.getTime() <= Date.now()
  ) {
    throw new AppError(410, "ROOM_EXPIRED", "Room has expired.");
  }
}

export function shapeRoomForUser(room: SelectedRoom, userId: string) {
  return {
    ...room,
    expiresAt: room.roomType === "GROUP" ? null : room.expiresAt,
    passcode: room.createdBy === userId ? room.passcode : null
  };
}

export async function getRoomOrThrow(roomId: string) {
  const room = await prisma.chatGroup.findUnique({
    where: {
      id: roomId
    },
    select: roomSelect
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  ensureActiveRoom(room);

  return room;
}

export async function getRoomPreview(roomId: string) {
  const room = await prisma.chatGroup.findUnique({
    where: {
      id: roomId
    },
    select: roomSelect
  });

  if (!room) {
    throw new AppError(404, "ROOM_NOT_FOUND", "Room was not found.");
  }

  return {
    id: room.id,
    title: room.title,
    roomType: room.roomType,
    description: room.description,
    createdBy: room.createdBy,
    isArchived: room.isArchived,
    expiresAt: room.roomType === "GROUP" ? null : room.expiresAt,
    isExpired: Boolean(
      room.roomType !== "GROUP" &&
        room.expiresAt &&
        room.expiresAt.getTime() <= Date.now()
    ),
    hasPasscode: Boolean(room.passcode),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    _count: room._count
  };
}

export async function assertRoomOwner(roomId: string, userId: string) {
  const room = await getRoomOrThrow(roomId);

  if (room.createdBy !== userId) {
    throw new AppError(
      403,
      "ROOM_OWNER_REQUIRED",
      "Only the room owner can perform this action."
    );
  }

  return room;
}

export async function assertRoomAccess(
  roomId: string,
  options: {
    userId?: string;
    email?: string;
    participantId?: string;
  }
) {
  const room = await getRoomOrThrow(roomId);

  if (options.userId) {
    if (room.createdBy === options.userId) {
      return room;
    }

    const member = await prisma.groupUser.findUnique({
      where: {
        groupId_userId: {
          groupId: roomId,
          userId: options.userId
        }
      },
      select: {
        id: true
      }
    });

    if (member) {
      return room;
    }
  }

  if (options.email) {
    const member = await prisma.groupUser.findFirst({
      where: {
        groupId: roomId,
        user: {
          email: options.email
        }
      },
      select: {
        id: true
      }
    });

    if (member) {
      return room;
    }
  }

  if (options.participantId) {
    const participant = await prisma.groupUser.findFirst({
      where: {
        id: options.participantId,
        groupId: roomId
      },
      select: {
        id: true
      }
    });

    if (participant) {
      return room;
    }
  }

  throw new AppError(403, "ROOM_ACCESS_DENIED", "Room access is required.");
}

export async function listRooms(userId: string, roomType?: "QUICK" | "GROUP") {
  const rooms = await prisma.chatGroup.findMany({
    where: {
      isArchived: false,
      OR: [
        {
          roomType: "GROUP"
        },
        {
          expiresAt: null
        },
        {
          expiresAt: {
            gt: new Date()
          }
        }
      ],
      ...(roomType ? { roomType: roomType as RoomType } : {}),
      AND: [
        {
          OR: [
            {
              createdBy: userId
            },
            {
              members: {
                some: {
                  userId
                }
              }
            }
          ]
        }
      ]
    },
    orderBy: {
      createdAt: "desc"
    },
    select: roomSelect
  });

  return rooms.map((room) => shapeRoomForUser(room, userId));
}

export async function getRoomForUser(roomId: string, userId: string) {
  const room = await assertRoomAccess(roomId, { userId });
  return shapeRoomForUser(room, userId);
}

export async function createRoom(
  input: RoomInput,
  user: {
    id: string;
    email: string;
    name: string;
  }
) {
  if (!input.passcode?.trim()) {
    throw new AppError(400, "PASSCODE_REQUIRED", "Room passcode is required.");
  }

  return prisma.$transaction(async (transaction) => {
    await transaction.user.upsert({
      where: {
        id: user.id
      },
      create: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: null,
        provider: "token",
        providerId: user.id
      },
      update: {
        name: user.name
      }
    });

    const room = await transaction.chatGroup.create({
      data: {
        title: input.title,
        roomType: input.roomType as RoomType,
        description: input.description ?? null,
        expiresAt: input.roomType === "GROUP" ? null : input.expiresAt ?? null,
        passcode: input.passcode,
        createdBy: user.id,
        peakUsers: 1,
        members: {
          create: {
            userId: user.id,
            displayName: user.name,
            isAnonymous: false,
            lastSeen: new Date()
          }
        }
      },
      select: roomSelect
    });

    return room;
  });
}

export async function updateRoom(
  roomId: string,
  input: UpdateRoomInput,
  userId: string
) {
  const room = await assertRoomOwner(roomId, userId);
  if ("passcode" in input && !input.passcode?.trim()) {
    throw new AppError(400, "PASSCODE_REQUIRED", "Room passcode is required.");
  }

  const data = {
    ...input,
    ...(room.roomType === "GROUP" ? { expiresAt: null } : {})
  };

  return prisma.chatGroup.update({
    where: {
      id: roomId
    },
    data,
    select: roomSelect
  });
}

export async function archiveRoom(roomId: string, userId: string) {
  await assertRoomOwner(roomId, userId);

  await prisma.chatGroup.update({
    where: {
      id: roomId
    },
    data: {
      isArchived: true
    }
  });
}

export async function joinRoom(
  roomId: string,
  input: JoinRoomInput,
  user?: {
    id: string;
    email?: string;
    name: string;
  }
) {
  const room = await getRoomOrThrow(roomId);

  if (room.passcode && room.passcode !== input.passcode) {
    throw new AppError(403, "INVALID_PASSCODE", "Room passcode is invalid.");
  }

  if (user) {
    const existing = await prisma.groupUser.findFirst({
      where: {
        groupId: roomId,
        OR: [
          {
            userId: user.id
          },
          ...(user.email
            ? [
                {
                  user: {
                    email: user.email
                  }
                }
              ]
            : [])
        ]
      },
      select: {
        id: true,
        groupId: true,
        userId: true,
        displayName: true,
        isAnonymous: true,
        joinedAt: true,
        lastSeen: true
      }
    });

    if (existing) {
      return existing;
    }
  }

  const displayName = user
    ? user.name
    : input.displayName ?? (input.isAnonymous ? "Anonymous" : "");

  if (!displayName) {
    throw new AppError(
      400,
      "DISPLAY_NAME_REQUIRED",
      "Display name is required for guest joins."
    );
  }

  if (!user) {
    const duplicateGuest = await prisma.groupUser.findFirst({
      where: {
        groupId: roomId,
        userId: null,
        displayName
      }
    });

    if (duplicateGuest) {
      throw new AppError(
        409,
        "ALREADY_JOINED",
        "A guest with this display name already joined this room."
      );
    }
  }

  const participant = await prisma.groupUser.create({
    data: {
      groupId: roomId,
      userId: user?.id ?? null,
      displayName,
      isAnonymous: input.isAnonymous,
      lastSeen: new Date()
    },
    select: {
      id: true,
      groupId: true,
      userId: true,
      displayName: true,
      isAnonymous: true,
      joinedAt: true,
      lastSeen: true
    }
  });

  const participantCount = await prisma.groupUser.count({
    where: {
      groupId: roomId
    }
  });

  if (participantCount > room.peakUsers) {
    await prisma.chatGroup.update({
      where: {
        id: roomId
      },
      data: {
        peakUsers: participantCount
      }
    });
  }

  return participant;
}

export async function getRoomAnalytics(roomId: string, userId: string) {
  const room = await assertRoomOwner(roomId, userId);

  return {
    totalMessages: room._count.messages,
    participants: room._count.members,
    onlineUsers: 0,
    peakUsers: room.peakUsers,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    roomType: room.roomType
  };
}
