import { Queue } from "bullmq";
import { createRedisConnectionOptions } from "../config/redis.js";
import { REALTIME_QUEUE_NAME, type RealtimeJob } from "./realtime.types.js";

export const realtimeQueue = new Queue<RealtimeJob, void, string>(REALTIME_QUEUE_NAME, {
  connection: createRedisConnectionOptions(),
  prefix: process.env.BULLMQ_QUEUE_PREFIX ?? "huddle",
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 1000
    },
    removeOnComplete: {
      age: 60 * 60,
      count: 1000
    },
    removeOnFail: {
      age: 24 * 60 * 60
    }
  }
});
