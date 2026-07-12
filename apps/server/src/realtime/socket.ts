import {
  heartbeatSocketSchema,
  joinRoomSocketSchema,
  leaveRoomSocketSchema,
  messageSocketSchema,
  reconnectSocketSchema,
  typingSocketSchema
} from "@huddle/shared";
import { createAdapter } from "@socket.io/redis-adapter";
import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { createSocketRedisConnection } from "../config/redis.js";
import { AppError } from "../errors/app-error.js";
import { enqueueMessagePersistence } from "../queues/realtime.producer.js";
import { logger } from "../utils/logger.js";
import { emitCaughtSocketError, emitSocketError } from "./errors.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from "./events.js";
import { PresenceService } from "./presence.service.js";
import {
  ensureRoomIsActive,
  listMissedMessages,
  resolveRoomParticipant,
  resolveSocketIdentity
} from "./room-access.js";
import { TypingService } from "./typing.service.js";

type HuddleSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type HuddleSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

function realtimeRoom(roomId: string) {
  return `room:${roomId}`;
}

function getHandshakeString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function socketCorsOrigin() {
  return (
    process.env.SOCKET_CORS_ORIGIN ??
    process.env.CORS_ORIGIN ??
    process.env.NEXT_PUBLIC_APP_URL
  );
}

function handleSocketError(
  io: HuddleSocketServer,
  socket: HuddleSocket,
  error: unknown,
  event: string,
  roomId?: string
) {
  if (error instanceof AppError && error.code === "ROOM_EXPIRED" && roomId) {
    io.to(realtimeRoom(roomId)).emit("room-expired", {
      roomId,
      message: error.message
    });
  }

  emitCaughtSocketError(socket, error, event, roomId);
}

async function leaveJoinedRoom(
  io: HuddleSocketServer,
  presence: PresenceService,
  typing: TypingService,
  socket: HuddleSocket,
  roomId: string
) {
  const participant = socket.data.joinedRooms.get(roomId);

  if (!participant) {
    emitSocketError(socket, "ROOM_NOT_JOINED", "Join the room before leaving.", {
      event: "leave-room",
      roomId
    });
    return;
  }

  await socket.leave(realtimeRoom(roomId));
  socket.data.joinedRooms.delete(roomId);
  await typing.stop(roomId, participant.participantId);

  const leaveResult = await presence.leaveRoom(socket.id, roomId, participant);

  if (leaveResult.isLastSocketForParticipant) {
    socket.to(realtimeRoom(roomId)).emit("typing-stop", {
      roomId,
      participant
    });
    io.to(realtimeRoom(roomId)).emit("user-left", leaveResult.snapshot);
    io.to(realtimeRoom(roomId)).emit(
      "presence-update",
      leaveResult.snapshot
    );
  }
}

export function configureRealtime(server: HttpServer) {
  const io: HuddleSocketServer = new Server(server, {
    cors: {
      origin: socketCorsOrigin(),
      credentials: true
    }
  });

  const pubClient = createSocketRedisConnection();
  const subClient = pubClient.duplicate();
  const presenceRedis = createSocketRedisConnection();
  const typingRedis = createSocketRedisConnection();
  const presence = new PresenceService(presenceRedis);
  const typing = new TypingService(typingRedis);

  pubClient.on("error", (error: Error) => {
    logger.error({ error }, "Socket.IO Redis pub client error");
  });
  subClient.on("error", (error: Error) => {
    logger.error({ error }, "Socket.IO Redis sub client error");
  });

  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    try {
      const token = getHandshakeString(socket.handshake.auth.token);
      const authorization = socket.handshake.headers.authorization;
      const identity = resolveSocketIdentity({
        token,
        authorization: Array.isArray(authorization)
          ? authorization[0]
          : authorization
      });

      socket.data.user = identity.user;
      socket.data.joinedRooms = new Map();
      next();
    } catch (error) {
      next(error instanceof Error ? error : new Error("Socket auth failed."));
    }
  });

  io.on("connection", (socket) => {
    socket.data.joinedRooms ??= new Map();
    logger.info(
      { socketId: socket.id, userId: socket.data.user?.id },
      "Realtime socket connected"
    );

    socket.on("join-room", (payload) => {
      void (async () => {
        const data = joinRoomSocketSchema.parse(payload);

        if (socket.data.joinedRooms.has(data.roomId)) {
          emitSocketError(
            socket,
            "ALREADY_JOINED_ROOM",
            "Socket already joined this room.",
            {
              event: "join-room",
              roomId: data.roomId
            }
          );
          return;
        }

        await ensureRoomIsActive(data.roomId);
        const participant = await resolveRoomParticipant(data.roomId, {
          userId: socket.data.user?.id,
          participantId: data.participantId
        });

        await socket.join(realtimeRoom(data.roomId));
        socket.data.joinedRooms.set(data.roomId, participant);

        const joinResult = await presence.joinRoom(
          socket.id,
          data.roomId,
          participant
        );

        if (joinResult.isFirstSocketForParticipant) {
          io.to(realtimeRoom(data.roomId)).emit("user-joined", joinResult.snapshot);
        }

        io.to(realtimeRoom(data.roomId)).emit(
          "presence-update",
          joinResult.snapshot
        );
      })().catch((error) => {
        handleSocketError(io, socket, error, "join-room");
      });
    });

    socket.on("leave-room", (payload) => {
      void (async () => {
        const data = leaveRoomSocketSchema.parse(payload);
        await leaveJoinedRoom(io, presence, typing, socket, data.roomId);
      })().catch((error) => {
        handleSocketError(io, socket, error, "leave-room");
      });
    });

    socket.on("message", (payload) => {
      void (async () => {
        const data = messageSocketSchema.parse(payload);
        const participant = socket.data.joinedRooms.get(data.roomId);

        if (!participant) {
          throw new AppError(
            403,
            "ROOM_NOT_JOINED",
            "Join the room before sending messages."
          );
        }

        await ensureRoomIsActive(data.roomId);
        const createdAt = new Date().toISOString();
        const message = {
          id: `tmp_${randomUUID()}`,
          clientMessageId: data.clientMessageId,
          roomId: data.roomId,
          sender: participant,
          kind: data.kind,
          text: data.text,
          fileUrl: data.fileUrl ?? null,
          fileType: data.fileType ?? null,
          fileName: data.fileName ?? null,
          createdAt,
          status: "queued" as const
        };

        io.to(realtimeRoom(data.roomId)).emit("message", message);

        try {
          await enqueueMessagePersistence({
            roomId: data.roomId,
            senderId: participant.participantId,
            senderName: participant.displayName,
            text: data.text,
            fileUrl: data.fileUrl ?? null,
            fileType: data.fileType ?? null,
            fileName: data.fileName ?? null,
            createdAt
          });
        } catch (error) {
          logger.error({ error, roomId: data.roomId }, "Failed to enqueue message");
          emitSocketError(
            socket,
            "QUEUE_UNAVAILABLE",
            "Message was broadcast but could not be queued for persistence.",
            {
              event: "message",
              roomId: data.roomId
            }
          );
        }
      })().catch((error) => {
        const roomId =
          typeof payload === "object" && payload && "roomId" in payload
            ? String(payload.roomId)
            : undefined;
        handleSocketError(io, socket, error, "message", roomId);
      });
    });

    socket.on("typing-start", (payload) => {
      void (async () => {
        const data = typingSocketSchema.parse(payload);
        const participant = socket.data.joinedRooms.get(data.roomId);

        if (!participant) {
          throw new AppError(
            403,
            "ROOM_NOT_JOINED",
            "Join the room before sending typing events."
          );
        }

        const shouldBroadcast = await typing.start(data.roomId, participant, () => {
          socket.to(realtimeRoom(data.roomId)).emit("typing-stop", {
            roomId: data.roomId,
            participant
          });
        });

        if (shouldBroadcast) {
          socket.to(realtimeRoom(data.roomId)).emit("typing-start", {
            roomId: data.roomId,
            participant
          });
        }
      })().catch((error) => {
        const roomId =
          typeof payload === "object" && payload && "roomId" in payload
            ? String(payload.roomId)
            : undefined;
        handleSocketError(io, socket, error, "typing-start", roomId);
      });
    });

    socket.on("typing-stop", (payload) => {
      void (async () => {
        const data = typingSocketSchema.parse(payload);
        const participant = socket.data.joinedRooms.get(data.roomId);

        if (!participant) {
          throw new AppError(
            403,
            "ROOM_NOT_JOINED",
            "Join the room before sending typing events."
          );
        }

        await typing.stop(data.roomId, participant.participantId);
        socket.to(realtimeRoom(data.roomId)).emit("typing-stop", {
          roomId: data.roomId,
          participant
        });
      })().catch((error) => {
        const roomId =
          typeof payload === "object" && payload && "roomId" in payload
            ? String(payload.roomId)
            : undefined;
        handleSocketError(io, socket, error, "typing-stop", roomId);
      });
    });

    socket.on("heartbeat", (payload) => {
      void (async () => {
        const data = heartbeatSocketSchema.parse(payload);
        const roomIds =
          data.roomIds.length > 0
            ? data.roomIds
            : Array.from(socket.data.joinedRooms.keys());

        for (const roomId of roomIds) {
          const participant = socket.data.joinedRooms.get(roomId);

          if (participant) {
            await presence.touchHeartbeat(roomId, participant.participantId);
          }
        }
      })().catch((error) => {
        handleSocketError(io, socket, error, "heartbeat");
      });
    });

    socket.on("reconnect", (payload) => {
      void (async () => {
        const data = reconnectSocketSchema.parse(payload);

        for (const room of data.rooms) {
          try {
            await ensureRoomIsActive(room.roomId);
            const participant =
              socket.data.joinedRooms.get(room.roomId) ??
              (await resolveRoomParticipant(room.roomId, {
                userId: socket.data.user?.id,
                participantId: room.participantId
              }));

            if (!socket.data.joinedRooms.has(room.roomId)) {
              await socket.join(realtimeRoom(room.roomId));
              socket.data.joinedRooms.set(room.roomId, participant);
              const joinResult = await presence.joinRoom(
                socket.id,
                room.roomId,
                participant
              );

              if (joinResult.isFirstSocketForParticipant) {
                io.to(realtimeRoom(room.roomId)).emit(
                  "user-joined",
                  joinResult.snapshot
                );
              }

              io.to(realtimeRoom(room.roomId)).emit(
                "presence-update",
                joinResult.snapshot
              );
            } else {
              await presence.touchHeartbeat(room.roomId, participant.participantId);
            }

            const missedMessages = await listMissedMessages(room.roomId, {
              lastMessageId: room.lastMessageId,
              since: room.since
            });

            socket.emit("missed-messages", {
              roomId: room.roomId,
              messages: missedMessages
            });
          } catch (error) {
            handleSocketError(io, socket, error, "reconnect", room.roomId);
          }
        }
      })().catch((error) => {
        handleSocketError(io, socket, error, "reconnect");
      });
    });

    socket.on("disconnect", (reason) => {
      void (async () => {
        logger.info({ socketId: socket.id, reason }, "Realtime socket disconnected");
        const leaves = await presence.leaveAllRooms(
          socket.id,
          socket.data.joinedRooms
        );

        for (const leave of leaves) {
          await typing.stop(leave.roomId, leave.participant.participantId);

          if (leave.isLastSocketForParticipant) {
            socket.to(realtimeRoom(leave.roomId)).emit("typing-stop", {
              roomId: leave.roomId,
              participant: leave.participant
            });
            io.to(realtimeRoom(leave.roomId)).emit("user-left", leave.snapshot);
            io.to(realtimeRoom(leave.roomId)).emit(
              "presence-update",
              leave.snapshot
            );
          }
        }

        socket.data.joinedRooms.clear();
      })().catch((error) => {
        logger.error({ error, socketId: socket.id }, "Disconnect cleanup failed");
      });
    });
  });

  return io;
}
