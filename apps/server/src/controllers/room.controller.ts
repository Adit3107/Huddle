import type { Request, Response } from "express";
import {
  archiveRoom,
  createRoom,
  getRoomAnalytics,
  getRoomForUser,
  getRoomPreview,
  joinRoom,
  listRooms,
  updateRoom
} from "../services/room.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { getParam } from "../utils/request-values.js";

function requireRequestUser(request: Request) {
  if (!request.user) {
    throw new Error("Authenticated user missing after auth middleware.");
  }

  return request.user;
}

export async function listRoomsController(request: Request, response: Response) {
  const user = requireRequestUser(request);
  const rooms = await listRooms(user.id, request.query.roomType as "QUICK" | "GROUP" | undefined);

  return sendSuccess(response, rooms);
}

export async function getRoomController(request: Request, response: Response) {
  const user = requireRequestUser(request);
  const room = await getRoomForUser(getParam(request, "id"), user.id);

  return sendSuccess(response, room);
}

export async function getRoomPreviewController(
  request: Request,
  response: Response
) {
  const room = await getRoomPreview(getParam(request, "id"));

  return sendSuccess(response, room);
}

export async function createRoomController(request: Request, response: Response) {
  const user = requireRequestUser(request);
  const room = await createRoom(request.body, user);

  return sendSuccess(response, room, 201);
}

export async function updateRoomController(request: Request, response: Response) {
  const user = requireRequestUser(request);
  const room = await updateRoom(getParam(request, "id"), request.body, user.id);

  return sendSuccess(response, room);
}

export async function deleteRoomController(request: Request, response: Response) {
  const user = requireRequestUser(request);
  await archiveRoom(getParam(request, "id"), user.id);

  return sendSuccess(response, { deleted: true });
}

export async function joinRoomController(request: Request, response: Response) {
  const participant = await joinRoom(getParam(request, "id"), request.body, request.user);

  return sendSuccess(response, participant, 201);
}

export async function roomAnalyticsController(
  request: Request,
  response: Response
) {
  const user = requireRequestUser(request);
  const analytics = await getRoomAnalytics(getParam(request, "id"), user.id);

  return sendSuccess(response, analytics);
}
