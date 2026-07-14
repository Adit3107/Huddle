import type { Request, Response } from "express";
import { listMessages } from "../services/message.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { getParam } from "../utils/request-values.js";

export async function listMessagesController(
  request: Request,
  response: Response
) {
  const messages = await listMessages(getParam(request, "roomId"), {
    userId: request.user?.id,
    email: request.user?.email,
    participantId: request.header("X-Participant-Id") ?? undefined,
    cursor: request.query.cursor as string | undefined,
    limit: Number(request.query.limit)
  });

  return sendSuccess(response, messages);
}
