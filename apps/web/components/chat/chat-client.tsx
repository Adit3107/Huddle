"use client";

import { generateAlias, type AliasProfile } from "@huddle/shared";
import type {
  ChatParticipant,
  ChatRoomPreview,
  PresenceSnapshot,
  RealtimeMessage,
  RealtimeMessageKind,
  SocketErrorPayload
} from "@huddle/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowDown,
  Clock3,
  Copy,
  Download,
  FileText,
  Loader2,
  LogOut,
  Menu,
  Paperclip,
  QrCode,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  UsersRound,
  X
} from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  getChatPreview,
  joinChatRoom,
  listChatMembers,
  listChatMessages,
  makeOptimisticMessage,
  normalizePersistedMessage,
  uploadChatFile,
  type ChatMessage,
  type LocalParticipant
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

interface ChatClientProps {
  roomId: string;
  backendUrl: string;
  backendToken: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

interface UploadDraft {
  file: File;
  previewUrl: string | null;
  progress: number;
  uploading: boolean;
}

const MESSAGE_PAGE_SIZE = 30;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function isNearBottom(element: HTMLDivElement) {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 160;
}

function storageKey(roomId: string) {
  return `huddle:chat:${roomId}:participant`;
}

function loadStoredParticipant(roomId: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(
      window.localStorage.getItem(storageKey(roomId)) ?? "null"
    ) as LocalParticipant | null;
  } catch {
    return null;
  }
}

function saveStoredParticipant(roomId: string, participant: LocalParticipant) {
  window.localStorage.setItem(storageKey(roomId), JSON.stringify(participant));
}

function removeStoredParticipant(roomId: string) {
  window.localStorage.removeItem(storageKey(roomId));
}

function roomUrl(roomId: string) {
  return `${window.location.origin}/chat/${roomId}`;
}

function Countdown({ preview }: { preview: ChatRoomPreview }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  if (preview.roomType === "GROUP") {
    return <Badge variant="secondary">Permanent</Badge>;
  }

  if (!preview.expiresAt) {
    return <Badge variant="secondary">No expiry</Badge>;
  }

  const remaining = new Date(preview.expiresAt).getTime() - now;

  if (remaining <= 0) {
    return <Badge variant="outline">Expired</Badge>;
  }

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return (
    <Badge variant="accent">
      <Clock3 aria-hidden="true" className="size-3" />
      {hours > 0 ? `${hours}h ${restMinutes}m` : `${restMinutes}m ${seconds}s`}
    </Badge>
  );
}

function EmptyIllustration({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mx-auto grid size-16 place-items-center rounded-full border border-border bg-secondary">
      <Icon className="size-7 text-emerald-300" />
    </div>
  );
}

function StatusPanel({
  icon,
  title,
  description,
  action
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
      <div className="max-w-md">
        <EmptyIllustration icon={icon} />
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

function MemberList({
  members,
  ownerId,
  onlineParticipants
}: {
  members: ChatParticipant[];
  ownerId: string;
  onlineParticipants: Set<string>;
}) {
  return (
    <div className="space-y-2">
      {members.map((member) => (
        <div
          className="flex items-center gap-3 rounded-2xl border border-border bg-background/35 p-3"
          key={member.id}
        >
          <Avatar className="size-9">
            <AvatarFallback>{initials(member.displayName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium">{member.displayName}</p>
              {member.userId === ownerId ? (
                <Badge variant="accent">Owner</Badge>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {member.isAnonymous ? "Anonymous" : member.user?.email ?? "Guest"}
            </p>
          </div>
          <span
            aria-label={onlineParticipants.has(member.id) ? "Online" : "Offline"}
            className={cn(
              "size-2.5 rounded-full",
              onlineParticipants.has(member.id) ? "bg-emerald-300" : "bg-muted"
            )}
          />
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  own
}: {
  message: ChatMessage;
  own: boolean;
}) {
  const imageUrl = message.kind === "IMAGE" ? message.fileUrl : null;

  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", own && "flex-row-reverse")}
      initial={{ opacity: 0, y: 10 }}
      layout
      transition={{ duration: 0.18 }}
    >
      <Avatar className="mt-1 size-9">
        <AvatarFallback>{initials(message.sender.displayName)}</AvatarFallback>
      </Avatar>
      <div className={cn("max-w-[78%] sm:max-w-[68%]", own && "items-end")}>
        <div className={cn("mb-1 flex items-center gap-2", own && "justify-end")}>
          <span className="truncate text-xs font-medium">
            {message.sender.displayName}
          </span>
          {message.sender.isAnonymous ? (
            <Badge variant="outline">Anon</Badge>
          ) : null}
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        </div>
        <div
          className={cn(
            "overflow-hidden rounded-2xl border px-4 py-3 shadow-sm",
            own
              ? "border-emerald-300/30 bg-emerald-300/15"
              : "border-border bg-card"
          )}
        >
          {message.text ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{message.text}</p>
          ) : null}
          {imageUrl ? (
            <a href={imageUrl} rel="noreferrer" target="_blank">
              <Image
                alt={message.fileName ?? "Uploaded image"}
                className="mt-3 h-auto max-h-80 w-auto rounded-xl object-contain"
                height={320}
                src={imageUrl}
                width={480}
              />
            </a>
          ) : message.fileUrl ? (
            <a
              className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background/45 p-3 text-sm transition hover:bg-secondary"
              href={message.fileUrl}
              rel="noreferrer"
              target="_blank"
            >
              <FileText className="size-5 text-emerald-300" />
              <span className="min-w-0 flex-1 truncate">
                {message.fileName ?? "Download file"}
              </span>
              <Download className="size-4" />
            </a>
          ) : null}
        </div>
        {message.optimistic || message.failed ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {message.failed ? "Failed to send" : "Sending..."}
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}

function JoinDialog({
  open,
  hasPasscode,
  joining,
  onJoin
}: {
  open: boolean;
  hasPasscode: boolean;
  joining: boolean;
  onJoin: (payload: {
    displayName: string;
    isAnonymous: boolean;
    passcode: string;
    alias: AliasProfile;
  }) => void;
}) {
  const [alias, setAlias] = useState(() => generateAlias());
  const [displayName, setDisplayName] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [passcode, setPasscode] = useState("");

  const visibleName = isAnonymous ? alias.alias : displayName;

  return (
    <Dialog open={open}>
      <DialogContent
        aria-describedby="join-room-description"
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Join this room</DialogTitle>
          <DialogDescription id="join-room-description">
            Choose how you will appear before entering the realtime chat.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onJoin({
              displayName: visibleName,
              isAnonymous,
              passcode,
              alias
            });
          }}
        >
          <label className="flex items-center justify-between rounded-2xl border border-border bg-secondary/60 p-3 text-sm">
            <span>Join anonymously</span>
            <input
              checked={isAnonymous}
              className="size-4 accent-emerald-400"
              onChange={(event) => setIsAnonymous(event.target.checked)}
              type="checkbox"
            />
          </label>
          {isAnonymous ? (
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <div className="flex items-center gap-3">
                <span
                  className="size-4 rounded-full"
                  style={{ backgroundColor: alias.color }}
                />
                <p className="flex-1 text-sm font-medium">{alias.alias}</p>
                <Button
                  aria-label="Reroll anonymous alias"
                  onClick={() => setAlias(generateAlias())}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="displayName">Name</Label>
              <Input
                id="displayName"
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter your name"
                required={!isAnonymous}
                value={displayName}
              />
            </div>
          )}
          {hasPasscode ? (
            <div className="grid gap-2">
              <Label htmlFor="passcode">Passcode</Label>
              <Input
                id="passcode"
                maxLength={64}
                onChange={(event) => setPasscode(event.target.value)}
                required
                type="password"
                value={passcode}
              />
            </div>
          ) : null}
          <Button disabled={joining || !visibleName.trim()} type="submit">
            {joining ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Join room
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChatClient({
  roomId,
  backendUrl,
  backendToken,
  user
}: ChatClientProps) {
  const [preview, setPreview] = useState<ChatRoomPreview | null>(null);
  const [participant, setParticipant] = useState<LocalParticipant | null>(null);
  const [members, setMembers] = useState<ChatParticipant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [uploadDraft, setUploadDraft] = useState<UploadDraft | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineParticipants, setOnlineParticipants] = useState<Set<string>>(
    () => new Set()
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const joinedRef = useRef(false);
  const participantRef = useRef<LocalParticipant | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const isJoined = Boolean(participant);
  const ownParticipantId = participant?.participantId;
  const ownUserId = user?.id ?? null;

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    let active = true;

    getChatPreview(roomId)
      .then((room) => {
        if (!active) {
          return;
        }

        setPreview(room);

        if (room.isArchived) {
          setError("This room has been archived.");
          return;
        }

        if (room.isExpired) {
          setError("This room has expired.");
          return;
        }

        if (room.roomType === "GROUP" && !backendToken) {
          setError("Sign in to access this group.");
          return;
        }

        if (room.roomType === "QUICK") {
          const stored = loadStoredParticipant(roomId);

          if (stored) {
            setParticipant(stored);
          }
        }
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "Unable to load room.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [backendToken, roomId]);

  const refreshMembers = useCallback(
    async (currentParticipant = participantRef.current) => {
      const items = await listChatMembers(roomId, currentParticipant?.participantId);
      setMembers(items);

      if (!currentParticipant && user) {
        const member = items.find((item) => item.userId === user.id);

        if (member) {
          setParticipant({
            participantId: member.id,
            userId: member.userId,
            displayName: member.displayName,
            isAnonymous: member.isAnonymous,
            color: "#10b981"
          });
        }
      }

      return items;
    },
    [roomId, user]
  );

  const loadMessages = useCallback(
    async (currentMembers: ChatParticipant[], cursor?: string | null) => {
      const data = await listChatMessages(roomId, {
        participantId: participantRef.current?.participantId,
        cursor,
        limit: MESSAGE_PAGE_SIZE
      });
      const normalized = data.items
        .map((item) => normalizePersistedMessage(item, currentMembers))
        .reverse();

      setMessages((current) =>
        cursor ? [...normalized, ...current] : normalized
      );
      setNextCursor(data.meta.nextCursor);
      setHasMore(data.meta.hasMore);
    },
    [roomId]
  );

  useEffect(() => {
    if (!preview || preview.isExpired || preview.isArchived || !isJoined) {
      return;
    }

    let active = true;

    refreshMembers()
      .then((items) => {
        if (active) {
          return loadMessages(items);
        }

        return undefined;
      })
      .catch((caught: unknown) => {
        if (preview.roomType === "QUICK") {
          removeStoredParticipant(roomId);
          setParticipant(null);
        }

        setError(caught instanceof Error ? caught.message : "Unable to enter room.");
      });

    return () => {
      active = false;
    };
  }, [isJoined, loadMessages, preview, refreshMembers, roomId]);

  useEffect(() => {
    if (!preview || !backendToken || preview.roomType !== "GROUP" || participant) {
      return;
    }

    refreshMembers().catch((caught: unknown) => {
      setError(
        caught instanceof Error
          ? caught.message
          : "You do not have access to this group."
      );
    });
  }, [backendToken, participant, preview, refreshMembers]);

  const mergeRealtimeMessages = useCallback((incoming: RealtimeMessage[]) => {
    setMessages((current) => {
      const byId = new Map<string, ChatMessage>();

      for (const message of current) {
        byId.set(message.id, message);
      }

      for (const message of incoming) {
        const optimisticMatch = message.clientMessageId
          ? current.find((item) => item.clientMessageId === message.clientMessageId)
          : undefined;

        if (optimisticMatch) {
          byId.delete(optimisticMatch.id);
        }

        byId.set(message.id, {
          ...message,
          optimistic: false
        });
      }

      return Array.from(byId.values()).sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });
  }, []);

  useEffect(() => {
    if (!preview || !participant || joinedRef.current) {
      return;
    }

    const socket = io(backendUrl, {
      auth: backendToken ? { token: backendToken } : {},
      transports: ["websocket", "polling"],
      reconnection: true
    });

    socketRef.current = socket;
    joinedRef.current = true;
    setConnectionStatus("connecting");

    const joinPayload = {
      roomId,
      ...(backendToken ? {} : { participantId: participant.participantId })
    };

    socket.on("connect", () => {
      setConnectionStatus("connected");
      socket.emit("join-room", joinPayload);
    });

    socket.io.on("reconnect_attempt", () => {
      setConnectionStatus("reconnecting");
    });

    socket.io.on("reconnect", () => {
      const lastMessage = messagesRef.current.at(-1);
      socket.emit("reconnect", {
        rooms: [
          {
            roomId,
            ...(backendToken ? {} : { participantId: participant.participantId }),
            lastMessageId: lastMessage?.id.startsWith("client_")
              ? undefined
              : lastMessage?.id,
            since: lastMessage?.createdAt
          }
        ]
      });
    });

    socket.on("disconnect", () => setConnectionStatus("disconnected"));
    socket.on("message", (message: RealtimeMessage) => {
      mergeRealtimeMessages([message]);

      requestAnimationFrame(() => {
        const container = scrollRef.current;

        if (container && isNearBottom(container)) {
          container.scrollTop = container.scrollHeight;
        }
      });
    });
    socket.on("missed-messages", (payload: { messages: RealtimeMessage[] }) => {
      mergeRealtimeMessages(payload.messages);
    });
    socket.on("presence-update", (payload: PresenceSnapshot) => {
      setOnlineParticipants(
        new Set(payload.participants.map((item) => item.participantId))
      );
      void refreshMembers();
    });
    socket.on("user-joined", (payload: PresenceSnapshot) => {
      setOnlineParticipants(
        new Set(payload.participants.map((item) => item.participantId))
      );
      void refreshMembers();
    });
    socket.on("user-left", (payload: PresenceSnapshot) => {
      setOnlineParticipants(
        new Set(payload.participants.map((item) => item.participantId))
      );
    });
    socket.on(
      "typing-start",
      (payload: { participant: { participantId: string; displayName: string } }) => {
        if (payload.participant.participantId === participant.participantId) {
          return;
        }

        setTypingUsers((current) =>
          current.includes(payload.participant.displayName)
            ? current
            : [...current, payload.participant.displayName]
        );
      }
    );
    socket.on(
      "typing-stop",
      (payload: { participant: { displayName: string } }) => {
        setTypingUsers((current) =>
          current.filter((name) => name !== payload.participant.displayName)
        );
      }
    );
    socket.on("room-expired", () => setError("This room has expired."));
    socket.on("socket-error", (payload: SocketErrorPayload) => {
      toast.error(payload.message);
    });

    const heartbeat = window.setInterval(() => {
      socket.emit("heartbeat", { roomIds: [roomId] });
    }, 25000);

    return () => {
      window.clearInterval(heartbeat);
      socket.emit("leave-room", { roomId });
      socket.disconnect();
      socketRef.current = null;
      joinedRef.current = false;
    };
  }, [
    backendToken,
    backendUrl,
    mergeRealtimeMessages,
    participant,
    preview,
    refreshMembers,
    roomId
  ]);

  useEffect(() => {
    const container = scrollRef.current;

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  useEffect(() => {
    if (!qrOpen) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(roomUrl(roomId), {
      margin: 2,
      width: 280,
      color: {
        dark: "#09090b",
        light: "#ffffff"
      }
    })
      .then(setQrDataUrl)
      .catch(() => toast.error("Unable to generate QR code"));
  }, [qrOpen, roomId]);

  const handleJoin = async (payload: {
    displayName: string;
    isAnonymous: boolean;
    passcode: string;
    alias: AliasProfile;
  }) => {
    setJoining(true);
    try {
      const joined = await joinChatRoom(roomId, {
        displayName: payload.displayName.trim(),
        isAnonymous: payload.isAnonymous,
        passcode: payload.passcode || undefined
      });
      const localParticipant = {
        participantId: joined.id,
        userId: joined.userId,
        displayName: joined.displayName,
        isAnonymous: joined.isAnonymous,
        color: payload.alias.color
      };

      saveStoredParticipant(roomId, localParticipant);
      setParticipant(localParticipant);
      toast.success("Joined room");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to join room");
    } finally {
      setJoining(false);
    }
  };

  const loadOlder = async () => {
    if (!nextCursor || loadingOlder) {
      return;
    }

    setLoadingOlder(true);
    try {
      await loadMessages(members, nextCursor);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Unable to load messages"
      );
    } finally {
      setLoadingOlder(false);
    }
  };

  const emitTyping = () => {
    const socket = socketRef.current;

    if (!socket || connectionStatus !== "connected") {
      return;
    }

    socket.emit("typing-start", { roomId });

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      socket.emit("typing-stop", { roomId });
    }, 1200);
  };

  const attachFile = (file: File) => {
    if (uploadDraft?.previewUrl) {
      URL.revokeObjectURL(uploadDraft.previewUrl);
    }

    setUploadDraft({
      file,
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
      progress: 0,
      uploading: false
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    const socket = socketRef.current;

    if (!participant || !socket || (!text && !uploadDraft)) {
      return;
    }

    let fileData:
      | {
          fileUrl: string;
          fileType: string;
          fileName: string;
        }
      | undefined;

    if (uploadDraft) {
      setUploadDraft((current) =>
        current ? { ...current, uploading: true, progress: 1 } : current
      );
      try {
        const uploaded = await uploadChatFile(roomId, uploadDraft.file, {
          participantId: participant.participantId,
          onProgress: (progress) =>
            setUploadDraft((current) =>
              current ? { ...current, progress } : current
            )
        });
        fileData = uploaded;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : "Upload failed");
        setUploadDraft((current) =>
          current ? { ...current, uploading: false } : current
        );
        return;
      }
    }

    const clientMessageId = crypto.randomUUID();
    const kind: RealtimeMessageKind = fileData
      ? fileData.fileType.startsWith("image/")
        ? "IMAGE"
        : "FILE"
      : "TEXT";
    const optimistic = makeOptimisticMessage({
      roomId,
      participant,
      clientMessageId,
      kind,
      text,
      fileUrl: fileData?.fileUrl,
      fileType: fileData?.fileType,
      fileName: fileData?.fileName
    });

    setMessages((current) => [...current, optimistic]);
    setInput("");

    if (uploadDraft?.previewUrl) {
      URL.revokeObjectURL(uploadDraft.previewUrl);
    }

    setUploadDraft(null);
    socket.emit("message", {
      roomId,
      clientMessageId,
      kind,
      text,
      fileUrl: fileData?.fileUrl,
      fileType: fileData?.fileType,
      fileName: fileData?.fileName
    });
    socket.emit("typing-stop", { roomId });
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(roomUrl(roomId));
    toast.success("Room link copied");
  };

  const leaveRoom = () => {
    socketRef.current?.emit("leave-room", { roomId });
    socketRef.current?.disconnect();

    if (preview?.roomType === "QUICK") {
      removeStoredParticipant(roomId);
    }

    window.location.href = preview?.roomType === "GROUP" ? "/dashboard" : "/";
  };

  const memberPanel = preview ? (
    <aside className="flex h-full flex-col border-l border-border bg-card/60 p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Members</p>
          <p className="text-xs text-muted-foreground">
            {onlineParticipants.size} online
          </p>
        </div>
        <Badge variant="outline">{members.length}</Badge>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <MemberList
          members={members}
          onlineParticipants={onlineParticipants}
          ownerId={preview.createdBy}
        />
      </div>
    </aside>
  ) : null;

  if (loading) {
    return (
      <StatusPanel
        description="Preparing the collaboration room and checking access."
        icon={Loader2}
        title="Loading chat"
      />
    );
  }

  if (error && (!preview || preview.isExpired || preview.isArchived || preview.roomType === "GROUP")) {
    return (
      <StatusPanel
        action={
          <Button asChild variant="outline">
            <a href={backendToken ? "/dashboard" : "/"}>Go back</a>
          </Button>
        }
        description={error}
        icon={AlertCircle}
        title="Chat unavailable"
      />
    );
  }

  if (!preview) {
    return (
      <StatusPanel
        description="The room could not be found."
        icon={AlertCircle}
        title="Missing room"
      />
    );
  }

  return (
    <main
      className="flex h-screen overflow-hidden bg-background text-foreground"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files.item(0);

        if (file) {
          attachFile(file);
        }
      }}
    >
      <JoinDialog
        hasPasscode={preview.hasPasscode}
        joining={joining}
        onJoin={handleJoin}
        open={preview.roomType === "QUICK" && !participant}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              aria-label="Open members"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Menu aria-hidden="true" />
            </Button>
            <div className="grid size-10 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
              {preview.roomType === "QUICK" ? (
                <Sparkles className="size-5 text-emerald-300" />
              ) : (
                <Shield className="size-5 text-emerald-300" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold sm:text-lg">
                {preview.title}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={preview.roomType === "QUICK" ? "accent" : "secondary"}>
                  {preview.roomType === "QUICK" ? "Quick Room" : "Group"}
                </Badge>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {onlineParticipants.size} online
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Countdown preview={preview} />
            <Button
              aria-label="Show QR code"
              onClick={() => setQrOpen(true)}
              size="icon"
              type="button"
              variant="outline"
            >
              <QrCode aria-hidden="true" />
            </Button>
            <Button
              aria-label="Copy room link"
              className="hidden sm:inline-flex"
              onClick={copyLink}
              size="icon"
              type="button"
              variant="outline"
            >
              <Copy aria-hidden="true" />
            </Button>
            <Button
              aria-label="Leave room"
              onClick={leaveRoom}
              size="icon"
              type="button"
              variant="ghost"
            >
              <LogOut aria-hidden="true" />
            </Button>
            <Avatar className="hidden size-9 sm:flex">
              <AvatarFallback>
                {initials(participant?.displayName ?? user?.name ?? "HD")}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {connectionStatus === "disconnected" ||
        connectionStatus === "reconnecting" ? (
          <div className="flex items-center justify-center gap-2 border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
            <RefreshCw className="size-4 animate-spin" />
            {connectionStatus === "reconnecting"
              ? "Reconnecting to realtime chat..."
              : "Disconnected. Reconnect is in progress."}
          </div>
        ) : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          onScroll={(event) => {
            if (event.currentTarget.scrollTop < 96 && hasMore) {
              void loadOlder();
            }
          }}
          ref={scrollRef}
        >
          {hasMore ? (
            <div className="mb-4 text-center">
              <Button
                disabled={loadingOlder}
                onClick={loadOlder}
                size="sm"
                type="button"
                variant="outline"
              >
                {loadingOlder ? <Loader2 className="animate-spin" /> : <ArrowDown />}
                Load older
              </Button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div className="grid h-full min-h-80 place-items-center text-center">
              <div>
                <EmptyIllustration icon={UsersRound} />
                <h2 className="mt-5 text-xl font-semibold">No messages yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Start the conversation when you are ready.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    own={
                      message.sender.participantId === ownParticipantId ||
                      Boolean(
                        ownUserId && message.sender.userId === ownUserId
                      )
                    }
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border bg-card/70 p-3 backdrop-blur-xl sm:p-4">
          <div aria-live="polite" className="mb-2 min-h-5 text-xs text-muted-foreground">
            {typingUsers.length > 0
              ? `${typingUsers.slice(0, 2).join(", ")} ${
                  typingUsers.length > 2 ? "and others " : ""
                }typing...`
              : connectionStatus === "connected"
                ? "Connected"
                : "Connecting..."}
          </div>
          {uploadDraft ? (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-border bg-background/45 p-3">
              {uploadDraft.previewUrl ? (
                <Image
                  alt="Upload preview"
                  className="size-14 rounded-xl object-cover"
                  height={56}
                  unoptimized
                  src={uploadDraft.previewUrl}
                  width={56}
                />
              ) : (
                <div className="grid size-14 place-items-center rounded-xl bg-secondary">
                  <FileText className="size-6 text-emerald-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {uploadDraft.file.name}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-emerald-300 transition-all"
                    style={{ width: `${uploadDraft.progress}%` }}
                  />
                </div>
              </div>
              <Button
                aria-label="Remove upload"
                disabled={uploadDraft.uploading}
                onClick={() => {
                  if (uploadDraft.previewUrl) {
                    URL.revokeObjectURL(uploadDraft.previewUrl);
                  }

                  setUploadDraft(null);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              aria-label="Attach file"
              className="sr-only"
              id="chat-file"
              onChange={(event) => {
                const file = event.target.files?.item(0);

                if (file) {
                  attachFile(file);
                }

                event.target.value = "";
              }}
              type="file"
            />
            <Button asChild size="icon" variant="outline">
              <label aria-label="Attach file" htmlFor="chat-file">
                <Paperclip aria-hidden="true" />
              </label>
            </Button>
            <Textarea
              aria-label="Message"
              className="max-h-36 min-h-11 resize-none"
              disabled={!participant}
              onChange={(event) => {
                setInput(event.target.value);
                emitTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }

                if (event.key === "Escape") {
                  setSidebarOpen(false);
                }
              }}
              onPaste={(event) => {
                const file = Array.from(event.clipboardData.files).find((item) =>
                  item.type.startsWith("image/")
                );

                if (file) {
                  attachFile(file);
                }
              }}
              placeholder="Message this room"
              value={input}
            />
            <Button
              aria-label="Send message"
              disabled={!participant || (!input.trim() && !uploadDraft)}
              onClick={() => void sendMessage()}
              size="icon"
              type="button"
            >
              {uploadDraft?.uploading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send aria-hidden="true" />
              )}
            </Button>
          </div>
        </footer>
      </section>

      <div className="hidden w-80 shrink-0 lg:block">{memberPanel}</div>

      <AnimatePresence>
        {sidebarOpen ? (
          <motion.div
            aria-modal="true"
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 bg-black/45 lg:hidden"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            role="dialog"
          >
            <motion.div
              animate={{ x: 0 }}
              className="ml-auto h-full w-[min(22rem,88vw)]"
              exit={{ x: "100%" }}
              initial={{ x: "100%" }}
              onClick={(event) => event.stopPropagation()}
              transition={{ duration: 0.2 }}
            >
              <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
                <span className="text-sm font-semibold">Room members</span>
                <Button
                  aria-label="Close members"
                  onClick={() => setSidebarOpen(false)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              {memberPanel}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Dialog onOpenChange={setQrOpen} open={qrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share room</DialogTitle>
            <DialogDescription>
              Scan the QR code or copy the room link.
            </DialogDescription>
          </DialogHeader>
          <div className="grid place-items-center rounded-2xl border border-border bg-white p-5">
            {qrDataUrl ? (
              <Image
                alt="Room QR code"
                className="size-64"
                height={256}
                unoptimized
                src={qrDataUrl}
                width={256}
              />
            ) : (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            )}
          </div>
          <Button onClick={copyLink} type="button" variant="outline">
            <Copy aria-hidden="true" /> Copy link
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
