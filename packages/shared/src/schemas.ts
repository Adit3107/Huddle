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

export const roomUploadParamsSchema = z.object({
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

export const participantAccessQuerySchema = z.object({
  participantId: cuidSchema.optional()
});

export const leaveMemberQuerySchema = z.object({
  participantId: cuidSchema.optional()
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

export const identityLoginSchema = z.object({
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

export const realtimeRoomIdSchema = z.object({
  roomId: cuidSchema
});

export const joinRoomSocketSchema = realtimeRoomIdSchema.extend({
  participantId: cuidSchema.optional()
});

export const leaveRoomSocketSchema = realtimeRoomIdSchema;

export const reconnectRoomSchema = realtimeRoomIdSchema.extend({
  participantId: cuidSchema.optional(),
  lastMessageId: cuidSchema.optional(),
  since: z.string().datetime().optional()
});

export const reconnectSocketSchema = z.object({
  rooms: z.array(reconnectRoomSchema).min(1).max(50)
});

export const heartbeatSocketSchema = z.object({
  roomIds: z.array(cuidSchema).max(50).default([])
});

export const messageSocketSchema = realtimeRoomIdSchema
  .extend({
    clientMessageId: z.string().trim().min(1).max(120).optional(),
    kind: z.enum(["TEXT", "FILE", "IMAGE"]).default("TEXT"),
    text: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .nullable()
      .transform((value) => (value && value.length > 0 ? value : null)),
    fileUrl: z.string().trim().url().optional().nullable(),
    fileType: z.string().trim().max(120).optional().nullable(),
    fileName: z.string().trim().max(255).optional().nullable()
  })
  .refine(
    (value) =>
      value.kind === "TEXT"
        ? Boolean(value.text)
        : Boolean(value.fileUrl) || Boolean(value.text),
    {
      message: "Message must include text or file data."
    }
  );

export const typingSocketSchema = realtimeRoomIdSchema;
