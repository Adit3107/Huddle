import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Router } from "express";
import multer from "multer";
import { uploadFile } from "../controllers/upload.controller.js";
import { AppError } from "../errors/app-error.js";
import { requireAuth } from "../middleware/auth.middleware.js";
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

uploadRoutes.post(
  "/",
  requireAuth,
  (request, response, next) => {
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
  },
  asyncHandler(uploadFile)
);

export default uploadRoutes;
