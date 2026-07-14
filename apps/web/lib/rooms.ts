export type RoomType = "QUICK" | "GROUP";

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface HuddleRoom {
  id: string;
  title: string;
  roomType: RoomType;
  description: string | null;
  expiresAt: string | null;
  passcode: string | null;
  createdBy: string;
  peakUsers: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
  _count: {
    members: number;
    messages: number;
  };
}

export interface RoomAnalytics {
  totalMessages: number;
  participants: number;
  onlineUsers: number;
  peakUsers: number;
  createdAt: string;
  expiresAt: string | null;
  roomType: RoomType;
}

export interface CreateRoomPayload {
  title: string;
  roomType: RoomType;
  description?: string | null;
  expiresAt?: string | null;
  passcode: string;
}

export interface UpdateRoomPayload {
  title?: string;
  description?: string | null;
  expiresAt?: string | null;
  passcode?: string | null;
}

export function getBackendUrl() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    throw new Error("NEXT_PUBLIC_BACKEND_URL is required.");
  }

  return backendUrl;
}

async function parseApiResponse<T>(response: Response) {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message =
      payload.success === false
        ? payload.error.message
        : "The backend request failed.";

    throw new Error(message);
  }

  return payload.data;
}

export async function roomRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {}
) {
  const headers = new Headers(init.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const requestUrl =
    typeof window === "undefined" ? `${getBackendUrl()}${path}` : path;

  const response = await fetch(requestUrl, {
    ...init,
    headers,
    cache: "no-store"
  });

  return parseApiResponse<T>(response);
}

export function listRooms(token: string, roomType?: RoomType) {
  const query = roomType ? `?roomType=${roomType}` : "";
  return roomRequest<HuddleRoom[]>(token, `/api/rooms${query}`);
}

export function createRoom(token: string, payload: CreateRoomPayload) {
  return roomRequest<HuddleRoom>(token, "/api/rooms", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateRoom(
  token: string,
  roomId: string,
  payload: UpdateRoomPayload
) {
  return roomRequest<HuddleRoom>(token, `/api/rooms/${roomId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function deleteRoom(token: string, roomId: string) {
  return roomRequest<{ deleted: true }>(token, `/api/rooms/${roomId}`, {
    method: "DELETE"
  });
}

export function getRoomAnalytics(token: string, roomId: string) {
  return roomRequest<RoomAnalytics>(token, `/api/rooms/${roomId}/analytics`);
}

export function isRoomOwner(
  room: Pick<HuddleRoom, "createdBy">,
  userId: string
) {
  return room.createdBy === userId;
}

export function roomInvitePath(roomId: string) {
  return `/chat/${roomId}`;
}

export function roomInviteUrl(roomId: string) {
  if (typeof window === "undefined") {
    return roomInvitePath(roomId);
  }

  return `${window.location.origin}${roomInvitePath(roomId)}`;
}

export function roomStatus(room: Pick<HuddleRoom, "isArchived" | "expiresAt">) {
  if (room.isArchived) {
    return "Archived";
  }

  if (room.expiresAt && new Date(room.expiresAt).getTime() <= Date.now()) {
    return "Expired";
  }

  return "Active";
}

export function formatDate(value: string | null) {
  if (!value) {
    return "No expiry";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
