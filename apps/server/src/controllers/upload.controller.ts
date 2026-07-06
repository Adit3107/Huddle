import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import {
  uploadRoomAttachment,
  UploadValidationError
} from "../services/upload.service.js";
import { sendSuccess } from "../utils/api-response.js";

export async function uploadFile(request: Request, response: Response) {
  try {
    const uploadedFile = await uploadRoomAttachment(request.file);

    return sendSuccess(response, uploadedFile, 201);
  } catch (error) {
    if (error instanceof UploadValidationError) {
      throw new AppError(400, "INVALID_UPLOAD", error.message);
    }

    throw error;
  }
}
