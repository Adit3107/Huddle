import type {
  PresenceSnapshot,
  RealtimeMessage,
  RealtimeParticipant,
  SocketErrorPayload
} from "@huddle/shared";

export interface MissedMessagesPayload {
  roomId: string;
  messages: RealtimeMessage[];
}

export interface RoomExpiredPayload {
  roomId: string;
  message: string;
}

export interface TypingPayload {
  roomId: string;
  participant: RealtimeParticipant;
}

export interface ServerToClientEvents {
  message: (payload: RealtimeMessage) => void;
  "typing-start": (payload: TypingPayload) => void;
  "typing-stop": (payload: TypingPayload) => void;
  "user-joined": (payload: PresenceSnapshot) => void;
  "user-left": (payload: PresenceSnapshot) => void;
  "room-expired": (payload: RoomExpiredPayload) => void;
  "presence-update": (payload: PresenceSnapshot) => void;
  "missed-messages": (payload: MissedMessagesPayload) => void;
  "socket-error": (payload: SocketErrorPayload) => void;
}

export interface ClientToServerEvents {
  "join-room": (payload: unknown) => void;
  "leave-room": (payload: unknown) => void;
  message: (payload: unknown) => void;
  "typing-start": (payload: unknown) => void;
  "typing-stop": (payload: unknown) => void;
  heartbeat: (payload: unknown) => void;
  reconnect: (payload: unknown) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  joinedRooms: Map<string, RealtimeParticipant>;
}
