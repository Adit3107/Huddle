import { v2 as cloudinary } from "cloudinary";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Cloudinary uploads.`);
  }

  return value;
}

export function configureCloudinary() {
  cloudinary.config({
    cloud_name: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: getRequiredEnv("CLOUDINARY_API_KEY"),
    api_secret: getRequiredEnv("CLOUDINARY_API_SECRET"),
    secure: true
  });
}

export default cloudinary;
