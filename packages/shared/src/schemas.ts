import { z } from "zod";

const cuidSchema = z.string().cuid();
const optionalTextSchema = z
  .string()
  .trim()
  .max(1000)
  .optional()
  .nullable()
  .transform((value) => (value && value.length > 0 ? value : null));

export const idParamsSchema = z.object({
  id: cuidSchema
});

export const roomIdParamsSchema = z.object({
  roomId: cuidSchema
});

export const roomTypeSchema = z.enum(["QUICK", "GROUP"]);

export const createRoomSchema = z.object({
  title: z.string().trim().min(1).max(120),
  roomType: roomTypeSchema,
  description: optionalTextSchema,
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .nullable()
    .transform((value) => (value ? new Date(value) : null)),
  passcode: z
    .string()
    .trim()
    .min(4)
    .max(64)
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null))
});

export const updateRoomSchema = createRoomSchema
  .pick({
    title: true,
    description: true,
    expiresAt: true,
    passcode: true
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one room field must be provided."
  });

export const joinRoomSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  isAnonymous: z.boolean().default(false),
  passcode: z.string().trim().max(64).optional()
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().toLowerCase()
});

export const removeMemberParamsSchema = z.object({
  id: cuidSchema,
  memberId: cuidSchema
});

export const messagesQuerySchema = z.object({
  cursor: cuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

export const roomsQuerySchema = z.object({
  roomType: roomTypeSchema.optional()
});

export const googleLoginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  name: z.string().trim().min(1),
  image: z
    .string()
    .trim()
    .url()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
  providerId: z.string().trim().min(1)
});
