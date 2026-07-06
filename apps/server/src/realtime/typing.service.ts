import type { RealtimeParticipant } from "@huddle/shared";
import type { Redis } from "ioredis";

function typingKey(roomId: string, participantId: string) {
  return `typing:${roomId}:${participantId}`;
}

function typingThrottleKey(roomId: string, participantId: string) {
  return `typing:${roomId}:${participantId}:throttle`;
}

export class TypingService {
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly redis: Redis) {}

  async start(
    roomId: string,
    participant: RealtimeParticipant,
    onTimeout: () => void
  ) {
    const throttleKey = typingThrottleKey(roomId, participant.participantId);
    const allowed = await this.redis.set(throttleKey, "1", "PX", 1000, "NX");

    if (!allowed) {
      return false;
    }

    const timeoutMs = Number(process.env.TYPING_TIMEOUT_MS ?? 3000);
    const key = typingKey(roomId, participant.participantId);

    await this.redis.set(key, JSON.stringify(participant), "PX", timeoutMs);
    this.scheduleTimeout(key, timeoutMs, onTimeout);

    return true;
  }

  async stop(roomId: string, participantId: string) {
    const key = typingKey(roomId, participantId);
    await this.redis.del(key);
    this.clearTimer(key);
  }

  private scheduleTimeout(key: string, timeoutMs: number, onTimeout: () => void) {
    this.clearTimer(key);
    const timer = setTimeout(() => {
      this.timers.delete(key);
      onTimeout();
    }, timeoutMs);

    this.timers.set(key, timer);
  }

  private clearTimer(key: string) {
    const timer = this.timers.get(key);

    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }
}
