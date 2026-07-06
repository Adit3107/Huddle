import {
  createRoomSchema,
  idParamsSchema,
  joinRoomSchema,
  removeMemberParamsSchema,
  roomsQuerySchema,
  updateRoomSchema,
  inviteMemberSchema
} from "@huddle/shared";
import { Router } from "express";
import {
  createRoomController,
  deleteRoomController,
  getRoomController,
  joinRoomController,
  listRoomsController,
  roomAnalyticsController,
  updateRoomController
} from "../controllers/room.controller.js";
import {
  inviteMemberController,
  listMembersController,
  removeMemberController
} from "../controllers/member.controller.js";
import { optionalAuth, requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { asyncHandler } from "../utils/async-handler.js";

const roomRoutes = Router();

roomRoutes.get(
  "/",
  requireAuth,
  validate({ query: roomsQuerySchema }),
  asyncHandler(listRoomsController)
);

roomRoutes.post(
  "/",
  requireAuth,
  validate({ body: createRoomSchema }),
  asyncHandler(createRoomController)
);

roomRoutes.get(
  "/:id",
  requireAuth,
  validate({ params: idParamsSchema }),
  asyncHandler(getRoomController)
);

roomRoutes.patch(
  "/:id",
  requireAuth,
  validate({ params: idParamsSchema, body: updateRoomSchema }),
  asyncHandler(updateRoomController)
);

roomRoutes.delete(
  "/:id",
  requireAuth,
  validate({ params: idParamsSchema }),
  asyncHandler(deleteRoomController)
);

roomRoutes.post(
  "/:id/join",
  optionalAuth,
  validate({ params: idParamsSchema, body: joinRoomSchema }),
  asyncHandler(joinRoomController)
);

roomRoutes.get(
  "/:id/analytics",
  requireAuth,
  validate({ params: idParamsSchema }),
  asyncHandler(roomAnalyticsController)
);

roomRoutes.get(
  "/:id/members",
  requireAuth,
  validate({ params: idParamsSchema }),
  asyncHandler(listMembersController)
);

roomRoutes.post(
  "/:id/members",
  requireAuth,
  validate({ params: idParamsSchema, body: inviteMemberSchema }),
  asyncHandler(inviteMemberController)
);

roomRoutes.delete(
  "/:id/members/:memberId",
  requireAuth,
  validate({ params: removeMemberParamsSchema }),
  asyncHandler(removeMemberController)
);

export default roomRoutes;
