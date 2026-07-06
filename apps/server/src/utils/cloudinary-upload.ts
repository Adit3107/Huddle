import type {
  UploadApiOptions,
  UploadApiResponse
} from "cloudinary";
import cloudinary, { configureCloudinary } from "../config/cloudinary.js";

export interface CloudinaryUploadOptions {
  folder: string;
  resourceType?: UploadApiOptions["resource_type"];
  transformations?: UploadApiOptions["transformation"];
}

export async function uploadToCloudinary(
  filePath: string,
  options: CloudinaryUploadOptions
): Promise<UploadApiResponse> {
  configureCloudinary();

  return cloudinary.uploader.upload(filePath, {
    folder: options.folder,
    resource_type: options.resourceType ?? "auto",
    transformation: options.transformations
  });
}
