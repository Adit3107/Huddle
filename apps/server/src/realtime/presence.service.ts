import type { PresenceSnapshot, RealtimeParticipant } from "@huddle/shared";
import type { Redis } from "ioredis";
import { enqueuePeakUsersUpdate } from "../queues/realtime.producer.js";

const ONLINE_USERS_KEY = "presence:online-users";
const ACTIVE_ROOMS_KEY = "presence:active-rooms";

function roomParticipantsKey(roomId: string) {
  return `presence:room:${roomId}:participants`;
}

function participantSocketsKey(roomId: string, participantId: string) {
  return `presence:room:${roomId}:participant:${participantId}:sockets`;
}

function socketRoomsKey(socketId: string) {
  return `presence:socket:${socketId}:rooms`;
}

function participantHeartbeatKey(roomId: string, participantId: string) {
  return `presence:room:${roomId}:participant:${participantId}:heartbeat`;
}

export class PresenceService {
  constructor(private readonly redis: Redis) {}

  async joinRoom(
    socketId: string,
    roomId: string,
    participant: RealtimeParticipant
  ) {
    const participantKey = JSON.stringify(participant);
    const socketCount = await this.redis.sadd(
      participantSocketsKey(roomId, participant.participantId),
      socketId
    );

    await this.redis.sadd(socketRoomsKey(socketId), roomId);
    await this.redis.sadd(ONLINE_USERS_KEY, participant.participantId);
    await this.redis.sadd(ACTIVE_ROOMS_KEY, roomId);
    await this.redis.sadd(roomParticipantsKey(roomId), participantKey);
    await this.touchHeartbeat(roomId, participant.participantId);

    const snapshot = await this.getPresence(roomId);
    await enqueuePeakUsersUpdate(roomId, snapshot.onlineUsers);

    return {
      isFirstSocketForParticipant: socketCount === 1,
      snapshot
    };
  }

  async leaveRoom(socketId: string, roomId: string, participant: RealtimeParticipant) {
    await this.redis.srem(socketRoomsKey(socketId), roomId);

    const socketSetKey = participantSocketsKey(roomId, participant.participantId);
    await this.redis.srem(socketSetKey, socketId);
    const remainingSockets = await this.redis.scard(socketSetKey);

    if (remainingSockets === 0) {
      await this.redis.del(socketSetKey);
      await this.redis.del(
        participantHeartbeatKey(roomId, participant.participantId)
      );
      await this.redis.srem(roomParticipantsKey(roomId), JSON.stringify(participant));
      await this.removeOnlineUserIfIdle(participant.participantId);
    }

    const snapshot = await this.getPresence(roomId);

    if (snapshot.onlineUsers === 0) {
      await this.redis.srem(ACTIVE_ROOMS_KEY, roomId);
    }

    return {
      isLastSocketForParticipant: remainingSockets === 0,
      snapshot
    };
  }

  async leaveAllRooms(
    socketId: string,
    participantsByRoom: Map<string, RealtimeParticipant>
  ) {
    const roomIds = await this.redis.smembers(socketRoomsKey(socketId));
    const leaves: Array<{
      roomId: string;
      participant: RealtimeParticipant;
      isLastSocketForParticipant: boolean;
      snapshot: PresenceSnapshot;
    }> = [];

    for (const roomId of roomIds) {
      const participant = participantsByRoom.get(roomId);

      if (!participant) {
        await this.redis.srem(socketRoomsKey(socketId), roomId);
        continue;
      }

      const result = await this.leaveRoom(socketId, roomId, participant);
      leaves.push({
        roomId,
        participant,
        ...result
      });
    }

    await this.redis.del(socketRoomsKey(socketId));
    return leaves;
  }

  async touchHeartbeat(roomId: string, participantId: string) {
    const ttlSeconds = Number(process.env.HEARTBEAT_TTL_SECONDS ?? 45);
    await this.redis.set(
      participantHeartbeatKey(roomId, participantId),
      String(Date.now()),
      "EX",
      ttlSeconds
    );
  }

  async getPresence(roomId: string): Promise<PresenceSnapshot> {
    const rawParticipants = await this.redis.smembers(roomParticipantsKey(roomId));
    const participants = rawParticipants
      .map((value) => JSON.parse(value) as RealtimeParticipant)
      .sort((first, second) =>
        first.displayName.localeCompare(second.displayName)
      );

    return {
      roomId,
      onlineUsers: participants.length,
      participants
    };
  }

  private async removeOnlineUserIfIdle(participantId: string) {
    const roomIds = await this.redis.smembers(ACTIVE_ROOMS_KEY);

    for (const roomId of roomIds) {
      const sockets = await this.redis.scard(
        participantSocketsKey(roomId, participantId)
      );

      if (sockets > 0) {
        return;
      }
    }

    await this.redis.srem(ONLINE_USERS_KEY, participantId);
  }
}
