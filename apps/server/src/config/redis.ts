import { Redis } from "ioredis";

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error("REDIS_URL is required for realtime services.");
  }

  return redisUrl;
}

export function createRedisConnection() {
  return new Redis(getRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

export function createSocketRedisConnection() {
  return new Redis(getRedisUrl());
}

export function createRedisConnectionOptions() {
  const redisUrl = new URL(getRedisUrl());

  return {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    username: redisUrl.username || undefined,
    password: redisUrl.password || undefined,
    db: redisUrl.pathname ? Number(redisUrl.pathname.slice(1) || 0) : 0,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}
