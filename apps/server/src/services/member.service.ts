import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";
import { AppError } from "../errors/app-error.js";
import { assertRoomAccess, assertRoomOwner } from "./room.service.js";

export async function listMembers(
  roomId: string,
  options: {
    userId?: string;
    email?: string;
    participantId?: string;
  }
) {
  await assertRoomAccess(roomId, options);

  return prisma.groupUser.findMany({
    where: {
      groupId: roomId
    },
    orderBy: {
      joinedAt: "asc"
    },
    select: {
      id: true,
      groupId: true,
      userId: true,
      displayName: true,
      isAnonymous: true,
      joinedAt: true,
      lastSeen: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true
        }
      }
    }
  });
}

export async function inviteMember(
  roomId: string,
  email: string,
  ownerId: string
) {
  const room = await assertRoomOwner(roomId, ownerId);

  if (room.roomType !== "GROUP") {
    throw new AppError(
      400,
      "GROUP_ROOM_REQUIRED",
      "Members can only be invited to group rooms."
    );
  }

  const user = await prisma.user.findUnique({
    where: {
      email
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true
    }
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "No user exists for this email.");
  }

  try {
    const member = await prisma.groupUser.create({
      data: {
        groupId: roomId,
        userId: user.id,
        displayName: user.name,
        isAnonymous: false
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

    return member;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AppError(409, "ALREADY_MEMBER", "User is already a member.");
    }

    throw error;
  }
}

export async function removeMember(
  roomId: string,
  memberId: string,
  ownerId: string
) {
  const room = await assertRoomOwner(roomId, ownerId);

  const member = await prisma.groupUser.findFirst({
    where: {
      id: memberId,
      groupId: roomId
    },
    select: {
      id: true,
      userId: true
    }
  });

  if (!member) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Member was not found.");
  }

  if (member.userId === room.createdBy) {
    throw new AppError(
      400,
      "OWNER_CANNOT_BE_REMOVED",
      "The room owner cannot be removed from the room."
    );
  }

  await prisma.groupUser.delete({
    where: {
      id: memberId
    }
  });
}

export async function leaveRoom(
  roomId: string,
  options: {
    userId?: string;
    email?: string;
    participantId?: string;
  }
) {
  const room = await assertRoomAccess(roomId, options);

  let member:
    | {
        id: string;
        userId: string | null;
      }
    | null = null;

  if (options.userId) {
    member = await prisma.groupUser.findUnique({
      where: {
        groupId_userId: {
          groupId: roomId,
          userId: options.userId
        }
      },
      select: {
        id: true,
        userId: true
      }
    });
  }

  if (!member && options.participantId) {
    member = await prisma.groupUser.findFirst({
      where: {
        id: options.participantId,
        groupId: roomId
      },
      select: {
        id: true,
        userId: true
      }
    });
  }

  if (!member) {
    throw new AppError(404, "MEMBER_NOT_FOUND", "Member was not found.");
  }

  if (member.userId === room.createdBy) {
    throw new AppError(
      400,
      "OWNER_CANNOT_LEAVE",
      "Room owners cannot leave their own room."
    );
  }

  await prisma.groupUser.delete({
    where: {
      id: member.id
    }
  });
}
