import type {
  ChatParticipant,
  ChatRoomPreview,
  PaginatedMessages,
  PersistedMessage,
  RealtimeMessage,
  RealtimeMessageKind,
  UploadedFileResponse
} from "@huddle/shared";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface LocalParticipant {
  participantId: string;
  userId: string | null;
  displayName: string;
  isAnonymous: boolean;
  color: string;
}

export type ChatMessage = RealtimeMessage & {
  optimistic?: boolean;
  failed?: boolean;
};

export interface JoinRoomPayload {
  displayName?: string;
  isAnonymous: boolean;
  passcode?: string;
}

function participantQuery(participantId?: string | null) {
  return participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
}

async function parseApiResponse<T>(response: Response) {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.success) {
    const message =
      payload.success === false
        ? payload.error.message
        : "The chat request failed.";

    throw new Error(message);
  }

  return payload.data;
}

export async function getChatPreview(roomId: string) {
  const response = await fetch(`/api/chat/${roomId}/preview`, {
    cache: "no-store"
  });

  return parseApiResponse<ChatRoomPreview>(response);
}

export async function joinChatRoom(roomId: string, payload: JoinRoomPayload) {
  const response = await fetch(`/api/chat/${roomId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<ChatParticipant>(response);
}

export async function listChatMembers(
  roomId: string,
  participantId?: string | null
) {
  const response = await fetch(
    `/api/chat/${roomId}/members${participantQuery(participantId)}`,
    {
      cache: "no-store"
    }
  );

  return parseApiResponse<ChatParticipant[]>(response);
}

export async function leaveChatRoom(
  roomId: string,
  participantId?: string | null
) {
  const response = await fetch(
    `/api/chat/${roomId}/members${participantQuery(participantId)}`,
    {
      method: "DELETE"
    }
  );

  return parseApiResponse<{ removed: true }>(response);
}

export async function removeChatMember(roomId: string, memberId: string) {
  const query = new URLSearchParams({ memberId });
  const response = await fetch(`/api/chat/${roomId}/members?${query.toString()}`, {
    method: "DELETE"
  });

  return parseApiResponse<{ removed: true }>(response);
}

export async function listChatMessages(
  roomId: string,
  options: {
    participantId?: string | null;
    cursor?: string | null;
    limit?: number;
  } = {}
) {
  const query = new URLSearchParams();

  if (options.participantId) {
    query.set("participantId", options.participantId);
  }

  if (options.cursor) {
    query.set("cursor", options.cursor);
  }

  if (options.limit) {
    query.set("limit", String(options.limit));
  }

  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`/api/chat/${roomId}/messages${suffix}`, {
    cache: "no-store"
  });

  return parseApiResponse<PaginatedMessages>(response);
}

export function uploadChatFile(
  roomId: string,
  file: File,
  options: {
    participantId?: string | null;
    onProgress?: (progress: number) => void;
  } = {}
) {
  const query = participantQuery(options.participantId);

  return new Promise<UploadedFileResponse>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    form.set("file", file);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    request.onload = () => {
      try {
        const payload = JSON.parse(request.responseText) as ApiResponse<UploadedFileResponse>;

        if (request.status < 200 || request.status >= 300 || !payload.success) {
          reject(
            new Error(
              payload.success === false
                ? payload.error.message
                : "Upload failed."
            )
          );
          return;
        }

        resolve(payload.data);
      } catch {
        reject(new Error("Upload returned an invalid response."));
      }
    };

    request.onerror = () => reject(new Error("Upload failed."));
    request.open("POST", `/api/chat/${roomId}/upload${query}`);
    request.send(form);
  });
}

export function normalizePersistedMessage(
  message: PersistedMessage,
  members: ChatParticipant[] = []
): ChatMessage {
  const member = members.find((item) => item.id === message.senderId);
  const kind: RealtimeMessageKind = message.fileUrl
    ? message.fileType?.startsWith("image/")
      ? "IMAGE"
      : "FILE"
    : "TEXT";

  return {
    id: message.id,
    roomId: message.groupId,
    sender: {
      participantId: message.senderId,
      userId: member?.userId ?? null,
      displayName: message.senderName,
      isAnonymous: member?.isAnonymous ?? false
    },
    kind,
    text: message.text,
    fileUrl: message.fileUrl,
    fileType: message.fileType,
    fileName: message.fileName,
    createdAt: message.createdAt,
    status: "persisted"
  };
}

export function makeOptimisticMessage(input: {
  roomId: string;
  participant: LocalParticipant;
  clientMessageId: string;
  kind: RealtimeMessageKind;
  text?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
}): ChatMessage {
  return {
    id: `client_${input.clientMessageId}`,
    clientMessageId: input.clientMessageId,
    roomId: input.roomId,
    sender: {
      participantId: input.participant.participantId,
      userId: input.participant.userId,
      displayName: input.participant.displayName,
      isAnonymous: input.participant.isAnonymous
    },
    kind: input.kind,
    text: input.text ?? null,
    fileUrl: input.fileUrl ?? null,
    fileType: input.fileType ?? null,
    fileName: input.fileName ?? null,
    createdAt: new Date().toISOString(),
    status: "queued",
    optimistic: true
  };
}
