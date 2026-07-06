import { unlink } from "node:fs/promises";
import { CLOUDINARY_FOLDERS } from "../config/cloudinary-folders.js";
import { uploadToCloudinary } from "../utils/cloudinary-upload.js";

const IMAGE_MIME_PREFIX = "image/";

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain"
]);

export const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  ...DOCUMENT_MIME_TYPES,
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

export interface UploadedFileResponse {
  fileUrl: string;
  publicId: string;
  fileType: string;
  fileName: string;
}

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

function getRoomUploadFolder(mimeType: string) {
  if (mimeType.startsWith(IMAGE_MIME_PREFIX)) {
    return CLOUDINARY_FOLDERS.rooms.images;
  }

  if (DOCUMENT_MIME_TYPES.has(mimeType)) {
    return CLOUDINARY_FOLDERS.rooms.documents;
  }

  return CLOUDINARY_FOLDERS.rooms.attachments;
}

export async function uploadRoomAttachment(
  file: Express.Multer.File | undefined
): Promise<UploadedFileResponse> {
  if (!file) {
    throw new UploadValidationError("A file is required.");
  }

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
    await removeTemporaryFile(file.path);
    throw new UploadValidationError("This file type is not supported.");
  }

  const folder = getRoomUploadFolder(file.mimetype);

  try {
    const uploadedFile = await uploadToCloudinary(file.path, {
      folder,
      resourceType: "auto"
    });

    return {
      fileUrl: uploadedFile.secure_url,
      publicId: uploadedFile.public_id,
      fileType: file.mimetype,
      fileName: file.originalname
    };
  } finally {
    await removeTemporaryFile(file.path);
  }
}

async function removeTemporaryFile(filePath: string) {
  try {
    await unlink(filePath);
  } catch {
    // The upload request should not fail just because cleanup already happened.
  }
}
