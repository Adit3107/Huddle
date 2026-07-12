import { Router } from "express";
import prisma from "../config/prisma.js";
import { createSocketRedisConnection } from "../config/redis.js";
import { sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const healthRoutes = Router();

healthRoutes.get("/live", (_request, response) => {
  return sendSuccess(response, {
    status: "ok",
    service: "huddle-api",
    timestamp: new Date().toISOString()
  });
});

healthRoutes.get(
  "/ready",
  asyncHandler(async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;

    const redis = createSocketRedisConnection();

    try {
      await redis.ping();
    } finally {
      redis.disconnect();
    }

    return sendSuccess(response, {
      status: "ready",
      dependencies: {
        database: "ok",
        redis: "ok"
      },
      timestamp: new Date().toISOString()
    });
  })
);

export default healthRoutes;
