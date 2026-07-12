import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import {
  participantAccessQuerySchema,
  roomUploadParamsSchema
} from "@huddle/shared";
import {
  uploadFile,
  uploadRoomFile
} from "../controllers/upload.controller.js";
import { AppError } from "../errors/app-error.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { assertRoomAccess } from "../services/room.service.js";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES
} from "../services/upload.service.js";
import { asyncHandler } from "../utils/async-handler.js";

const uploadRoutes = Router();
const uploadTempDirectory = join(tmpdir(), "huddle-uploads");

const storage = multer.diskStorage({
  async destination(_request, _file, callback) {
    try {
      await mkdir(uploadTempDirectory, { recursive: true });
      callback(null, uploadTempDirectory);
    } catch (error) {
      callback(error as Error, uploadTempDirectory);
    }
  },
  filename(_request, file, callback) {
    const safeSuffix = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    callback(null, `${Date.now()}-${randomUUID()}-${safeSuffix}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_SIZE_BYTES
  },
  fileFilter(_request, file, callback) {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      callback(new Error("UNSUPPORTED_FILE_TYPE"));
      return;
    }

    callback(null, true);
  }
});

function handleSingleUpload(
  request: Request,
  response: Response,
  next: NextFunction
) {
  upload.single("file")(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return next(
        new AppError(
        413,
        "FILE_TOO_LARGE",
        "File size must not exceed 5MB."
        )
      );
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_FILE_TYPE") {
      return next(
        new AppError(
        400,
        "INVALID_UPLOAD",
        "This file type is not supported."
        )
      );
    }

    if (error) {
      return next(error);
    }

    return next();
  });
}

uploadRoutes.post(
  "/",
  requireAuth,
  handleSingleUpload,
  asyncHandler(uploadFile)
);

uploadRoutes.post(
  "/rooms/:roomId",
  optionalAuth,
  validate({ params: roomUploadParamsSchema, query: participantAccessQuerySchema }),
  asyncHandler(async (request, _response, next) => {
    await assertRoomAccess(request.params.roomId as string, {
      userId: request.user?.id,
      participantId:
        (request.query.participantId as string | undefined) ??
        request.header("X-Participant-Id") ??
        undefined
    });
    next();
  }),
  handleSingleUpload,
  asyncHandler(uploadRoomFile)
);

export default uploadRoutes;
