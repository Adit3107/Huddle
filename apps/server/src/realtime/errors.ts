import type { Socket } from "socket.io";
import { ZodError } from "zod";
import { AppError } from "../errors/app-error.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData
} from "./events.js";

type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function emitSocketError(
  socket: RealtimeSocket,
  code: string,
  message: string,
  options: {
    event?: string;
    roomId?: string;
    details?: unknown;
  } = {}
) {
  socket.emit("socket-error", {
    code,
    message,
    ...options
  });
}

export function emitCaughtSocketError(
  socket: RealtimeSocket,
  error: unknown,
  event: string,
  roomId?: string
) {
  if (error instanceof ZodError) {
    emitSocketError(socket, "MALFORMED_PAYLOAD", "Payload is invalid.", {
      event,
      roomId,
      details: error.issues
    });
    return;
  }

  if (error instanceof AppError) {
    emitSocketError(socket, error.code, error.message, {
      event,
      roomId
    });
    return;
  }

  emitSocketError(socket, "SOCKET_ERROR", "Realtime operation failed.", {
    event,
    roomId
  });
}
