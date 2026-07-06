export const CLOUDINARY_ROOT_FOLDER = "huddle";

export const CLOUDINARY_FOLDERS = {
  users: {
    profileImages: `${CLOUDINARY_ROOT_FOLDER}/users/profile-images`
  },
  rooms: {
    images: `${CLOUDINARY_ROOT_FOLDER}/rooms/images`,
    documents: `${CLOUDINARY_ROOT_FOLDER}/rooms/documents`,
    attachments: `${CLOUDINARY_ROOT_FOLDER}/rooms/attachments`
  },
  groups: {
    images: `${CLOUDINARY_ROOT_FOLDER}/groups/images`,
    documents: `${CLOUDINARY_ROOT_FOLDER}/groups/documents`,
    logos: `${CLOUDINARY_ROOT_FOLDER}/groups/logos`
  },
  temp: `${CLOUDINARY_ROOT_FOLDER}/temp`,
  exports: `${CLOUDINARY_ROOT_FOLDER}/exports`
} as const;
