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

export interface ChatRoomPreview {
  id: string;
  title: string;
  roomType: "QUICK" | "GROUP";
  description: string | null;
  expiresAt: string | null;
  createdBy: string;
  isArchived: boolean;
  isExpired: boolean;
  hasPasscode: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    members: number;
    messages: number;
  };
}

export interface ChatParticipant {
  id: string;
  groupId: string;
  userId: string | null;
  displayName: string;
  isAnonymous: boolean;
  joinedAt: string;
  lastSeen: string | null;
  user?: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  } | null;
}

export interface PersistedMessage {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  text: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMessages {
  items: PersistedMessage[];
  meta: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

export interface UploadedFileResponse {
  fileUrl: string;
  publicId: string;
  fileType: string;
  fileName: string;
}
