export interface QuickRoom {}

export interface Group {}

export interface HuddleUser {}

export type RealtimeMessageKind = "TEXT" | "FILE" | "IMAGE";

export interface RealtimeParticipant {
  participantId: string;
  userId: string | null;
  displayName: string;
  isAnonymous: boolean;
}

export interface RealtimeMessage {
  id: string;
  clientMessageId?: string;
  roomId: string;
  sender: RealtimeParticipant;
  kind: RealtimeMessageKind;
  text: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileName: string | null;
  createdAt: string;
  status: "queued" | "persisted";
}

export interface PresenceSnapshot {
  roomId: string;
  onlineUsers: number;
  participants: RealtimeParticipant[];
}

export interface SocketErrorPayload {
  code: string;
  message: string;
  event?: string;
  roomId?: string;
  details?: unknown;
}
