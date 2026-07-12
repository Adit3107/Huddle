import type { Request, Response } from "express";
import { AppError } from "../errors/app-error.js";
import {
  uploadRoomAttachment,
  UploadValidationError
} from "../services/upload.service.js";
import { assertRoomAccess } from "../services/room.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { getParam } from "../utils/request-values.js";

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

export async function uploadRoomFile(request: Request, response: Response) {
  await assertRoomAccess(getParam(request, "roomId"), {
    userId: request.user?.id,
    participantId:
      (request.query.participantId as string | undefined) ??
      request.header("X-Participant-Id") ??
      undefined
  });

  return uploadFile(request, response);
}
