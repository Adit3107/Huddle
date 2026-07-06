import type { Request, Response } from "express";
import {
  inviteMember,
  listMembers,
  removeMember
} from "../services/member.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { getParam } from "../utils/request-values.js";

function requireRequestUser(request: Request) {
  if (!request.user) {
    throw new Error("Authenticated user missing after auth middleware.");
  }

  return request.user;
}

export async function listMembersController(
  request: Request,
  response: Response
) {
  const user = requireRequestUser(request);
  const members = await listMembers(getParam(request, "id"), user.id);

  return sendSuccess(response, members);
}

export async function inviteMemberController(
  request: Request,
  response: Response
) {
  const user = requireRequestUser(request);
  const member = await inviteMember(getParam(request, "id"), request.body.email, user.id);

  return sendSuccess(response, member, 201);
}

export async function removeMemberController(
  request: Request,
  response: Response
) {
  const user = requireRequestUser(request);
  await removeMember(
    getParam(request, "id"),
    getParam(request, "memberId"),
    user.id
  );

  return sendSuccess(response, { removed: true });
}
