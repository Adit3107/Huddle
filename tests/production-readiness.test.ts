import test from "node:test";
import assert from "node:assert/strict";
import {
  createRoomSchema,
  leaveMemberQuerySchema,
  joinRoomSchema,
  messageSocketSchema
} from "@huddle/shared";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES
} from "../apps/server/src/services/upload.service.ts";
import { shapeRoomForUser } from "../apps/server/src/services/room.service.ts";
import { sendError, sendSuccess } from "../apps/server/src/utils/api-response.ts";

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    }
  };

  return response;
}

test("shared room schemas accept production room payloads", () => {
  const room = createRoomSchema.parse({
    title: "Design Crit",
    roomType: "QUICK",
    description: "Weekly review",
    passcode: "focus",
    expiresAt: new Date(Date.now() + 60_000).toISOString()
  });

  assert.equal(room.title, "Design Crit");
  assert.equal(room.roomType, "QUICK");

  const participant = joinRoomSchema.parse({
    displayName: "Guest Designer",
    isAnonymous: true,
    passcode: "focus"
  });

  assert.equal(participant.isAnonymous, true);
});

test("room response shaping only exposes passcodes to owners", () => {
  const room = {
    id: "clz123456000008l30abc1234",
    title: "Design Crit",
    roomType: "GROUP",
    description: null,
    expiresAt: null,
    passcode: "focus",
    createdBy: "owner_1",
    owner: {
      id: "owner_1",
      email: "owner@example.com",
      name: "Owner",
      image: null
    },
    peakUsers: 1,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      members: 2,
      messages: 0
    }
  };

  assert.equal(shapeRoomForUser(room as never, "owner_1").passcode, "focus");
  assert.equal(shapeRoomForUser(room as never, "member_1").passcode, null);
});

test("leave member query validates optional participant access", () => {
  const parsed = leaveMemberQuerySchema.parse({
    participantId: "clz123456000008l30abc1234"
  });

  assert.equal(parsed.participantId, "clz123456000008l30abc1234");
  assert.deepEqual(leaveMemberQuerySchema.parse({}), {});
});

test("realtime message schema requires meaningful content", () => {
  const valid = messageSocketSchema.parse({
    roomId: "clz123456000008l30abc1234",
    clientMessageId: "local-1",
    kind: "TEXT",
    text: "Hello team"
  });

  assert.equal(valid.text, "Hello team");
  assert.throws(() =>
    messageSocketSchema.parse({
      roomId: "clz123456000008l30abc1234",
      kind: "TEXT",
      text: ""
    })
  );
});

test("upload defaults keep risky files out and cap size", () => {
  assert.equal(MAX_UPLOAD_SIZE_BYTES, 5 * 1024 * 1024);
  assert.equal(ALLOWED_UPLOAD_MIME_TYPES.has("image/png"), true);
  assert.equal(ALLOWED_UPLOAD_MIME_TYPES.has("application/pdf"), true);
  assert.equal(ALLOWED_UPLOAD_MIME_TYPES.has("application/x-msdownload"), false);
});

test("api response helpers keep a stable envelope", () => {
  const successResponse = createMockResponse();
  sendSuccess(successResponse as never, { ok: true }, 201);

  assert.equal(successResponse.statusCode, 201);
  assert.deepEqual(successResponse.body, {
    success: true,
    data: { ok: true }
  });

  const errorResponse = createMockResponse();
  sendError(errorResponse as never, 429, "RATE_LIMITED", "Slow down.");

  assert.equal(errorResponse.statusCode, 429);
  assert.deepEqual(errorResponse.body, {
    success: false,
    error: {
      code: "RATE_LIMITED",
      message: "Slow down."
    }
  });
});
