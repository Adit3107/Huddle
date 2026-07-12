import dotenv from "dotenv";
import { Worker } from "bullmq";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRedisConnectionOptions } from "../config/redis.js";
import prisma from "../config/prisma.js";
import {
  REALTIME_QUEUE_NAME,
  type RealtimeJob
} from "../queues/realtime.types.js";
import { logger } from "../utils/logger.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: resolve(currentDir, "../../../../.env"),
  quiet: true
});

const worker = new Worker<RealtimeJob, void, string>(
  REALTIME_QUEUE_NAME,
  async (job) => {
    if (job.data.type === "persist-message") {
      const message = job.data.message;

      await prisma.message.create({
        data: {
          groupId: message.roomId,
          senderId: message.senderId,
          senderName: message.senderName,
          text: message.text,
          fileUrl: message.fileUrl,
          fileType: message.fileType,
          fileName: message.fileName,
          createdAt: new Date(message.createdAt)
        }
      });

      return;
    }

    await prisma.chatGroup.updateMany({
      where: {
        id: job.data.roomId,
        peakUsers: {
          lt: job.data.activeUsers
        }
      },
      data: {
        peakUsers: job.data.activeUsers
      }
    });
  },
  {
    connection: createRedisConnectionOptions(),
    prefix: process.env.BULLMQ_QUEUE_PREFIX ?? "huddle",
    concurrency: Number(process.env.REALTIME_WORKER_CONCURRENCY ?? 5)
  }
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "Realtime job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    {
      jobId: job?.id,
      jobName: job?.name,
      error
    },
    "Realtime job failed"
  );
});

worker.on("error", (error) => {
  logger.error({ error }, "Realtime worker error");
});

async function shutdown() {
  logger.info("Shutting down realtime worker");
  await worker.close();
  await prisma.$disconnect();
}

process.on("SIGTERM", () => {
  void shutdown().then(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().then(() => process.exit(0));
});
