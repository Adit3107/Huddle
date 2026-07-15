import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "node:http";
import { pinoHttp } from "pino-http";
import { getCorsOrigins, validateProductionEnv } from "./config/env.js";
import {
  globalErrorHandler,
  notFoundHandler
} from "./middleware/error.middleware.js";
import { sanitizeInput } from "./middleware/security.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";
import messageRoutes from "./routes/message.routes.js";
import roomRoutes from "./routes/room.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import { configureRealtime } from "./realtime/socket.js";
import { logger } from "./utils/logger.js";

dotenv.config({ quiet: true });
validateProductionEnv();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const corsOrigins = getCorsOrigins();

app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);
app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);
app.use(compression());
app.use(
  pinoHttp({
    logger
  })
);
app.use(cookieParser());
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhookRoutes);
app.use(express.json({ limit: "1mb" }));
app.use(sanitizeInput);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/upload", uploadRoutes);

app.get("/", (_request, response) => {
  response.send("Huddle Backend Running");
});

app.use(notFoundHandler);
app.use(globalErrorHandler);

const server = createServer(app);
configureRealtime(server);

server.listen(port, () => {
  logger.info({ port }, "Huddle backend listening");
});
