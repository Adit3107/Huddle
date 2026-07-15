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
  ArrowLeft,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileText,
  Loader2,
  LogOut,
  MessageCircle,
  Menu,
  Paperclip,
  QrCode,
  RefreshCw,
  Send,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Trash2,
  UserMinus,
  UsersRound,
  X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import {
  getChatPreview,
  joinChatRoom,
  leaveChatRoom,
  listChatMembers,
  listChatMessages,
  makeOptimisticMessage,
  normalizePersistedMessage,
  removeChatMember,
  uploadChatFile,
  type ChatMessage,
  type LocalParticipant
} from "@/lib/chat";
import { deleteRoom, formatDate, updateRoom } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
type ShareMode = "link" | "qr";

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

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
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

function roomExpiryText(preview: Pick<ChatRoomPreview, "roomType" | "expiresAt">) {
  return preview.roomType === "GROUP" ? "Permanent" : formatDate(preview.expiresAt);
}

function shareText(preview: ChatRoomPreview) {
  const noun = preview.roomType === "GROUP" ? "group" : "room";
  return `Join this ${noun} "${preview.title}" on HUDDLE: ${roomUrl(preview.id)}`;
}

async function copyShareMessage(preview: ChatRoomPreview) {
  await navigator.clipboard.writeText(shareText(preview));
  toast.success("Share message copied");
}

function openShareUrl(kind: "whatsapp" | "telegram", preview: ChatRoomPreview) {
  const text = encodeURIComponent(shareText(preview));
  const url =
    kind === "whatsapp"
      ? `https://wa.me/?text=${text}`
      : `https://t.me/share/url?url=${encodeURIComponent(roomUrl(preview.id))}&text=${encodeURIComponent(
          shareText(preview).replace(roomUrl(preview.id), "").trim()
        )}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

async function shareToInstagram(preview: ChatRoomPreview) {
  if (navigator.share) {
    await navigator.share({
      title: preview.title,
      text: shareText(preview),
      url: roomUrl(preview.id)
    });
    return;
  }

  await copyShareMessage(preview);
  toast.info("Paste the copied invite into Instagram");
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
  canManage,
  members,
  onRemove,
  ownerId,
  onlineParticipants
}: {
  canManage: boolean;
  members: ChatParticipant[];
  onRemove: (member: ChatParticipant) => void;
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
          {canManage && member.userId !== ownerId ? (
            <Button
              aria-label={`Remove ${member.displayName}`}
              onClick={() => onRemove(member)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <UserMinus aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
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
      <div className={cn("min-w-0 max-w-[82%] sm:max-w-[68%]", own && "items-end")}>
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
            <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
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
  defaultName,
  defaultPasscode,
  hasPasscode,
  joining,
  onJoin
}: {
  open: boolean;
  defaultName: string;
  defaultPasscode: string;
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
  const [displayName, setDisplayName] = useState(defaultName);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [passcode, setPasscode] = useState(defaultPasscode);

  const visibleName = isAnonymous ? alias.alias : displayName;

  useEffect(() => {
    if (open) {
      setDisplayName(defaultName);
      setPasscode(defaultPasscode);
    }
  }, [defaultName, defaultPasscode, open]);

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
  const [groupMembershipChecked, setGroupMembershipChecked] = useState(false);
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
  const [shareMode, setShareMode] = useState<ShareMode>("link");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ChatParticipant | null>(null);
  const [roomActionLoading, setRoomActionLoading] = useState(false);
  const [joinPasscodeHint, setJoinPasscodeHint] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.sessionStorage.getItem(`huddle:join:${roomId}:passcode`) ?? "";
  });
  const [settingsForm, setSettingsForm] = useState({
    title: "",
    description: "",
    expiresAt: "",
    passcode: ""
  });
  const [settingsPasscodeDirty, setSettingsPasscodeDirty] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const joinedRef = useRef(false);
  const participantRef = useRef<LocalParticipant | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const isJoined = Boolean(participant);
  const ownParticipantId = participant?.participantId;
  const ownUserId = user?.id ?? null;
  const isOwner = Boolean(user && preview?.createdBy === user.id);
  const showJoinDialog =
    !participant &&
    (preview?.roomType === "QUICK" ||
      (preview?.roomType === "GROUP" &&
        Boolean(backendToken) &&
        groupMembershipChecked));

  useEffect(() => {
    participantRef.current = participant;
  }, [participant]);

  useEffect(() => {
    if (!preview) {
      return;
    }

    setSettingsForm({
      title: preview.title,
      description: preview.description ?? "",
      expiresAt: toDatetimeLocal(preview.expiresAt),
      passcode: ""
    });
    setSettingsPasscodeDirty(false);
  }, [preview]);

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
        setGroupMembershipChecked(false);

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
          setGroupMembershipChecked(true);
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
        const member = items.find(
          (item) => item.userId === user.id || item.user?.email === user.email
        );

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
    async (
      currentMembers: ChatParticipant[],
      cursor?: string | null,
      currentParticipant = participantRef.current
    ) => {
      const data = await listChatMessages(roomId, {
        participantId: currentParticipant?.participantId,
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

    const currentParticipant = participantRef.current;

    refreshMembers(currentParticipant)
      .then((items) => {
        if (active) {
          return loadMessages(items, null, currentParticipant);
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

    let active = true;
    setGroupMembershipChecked(false);

    refreshMembers()
      .catch(() => {
        setMembers([]);
      })
      .finally(() => {
        if (active) {
          setGroupMembershipChecked(true);
        }
      });

    return () => {
      active = false;
    };
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
      window.sessionStorage.removeItem(`huddle:join:${roomId}:passcode`);
      setJoinPasscodeHint("");
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

  const performLeave = async () => {
    setRoomActionLoading(true);
    try {
      await leaveChatRoom(roomId, preview?.roomType === "QUICK" ? participant?.participantId : null);
      socketRef.current?.emit("leave-room", { roomId });
      socketRef.current?.disconnect();

      if (preview?.roomType === "QUICK") {
        removeStoredParticipant(roomId);
      }

      toast.success("Left room");
      window.location.href = preview?.roomType === "GROUP" ? "/dashboard" : "/";
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to leave room");
    } finally {
      setRoomActionLoading(false);
      setLeaveConfirmOpen(false);
    }
  };

  const requestLeaveRoom = () => {
    if (preview?.roomType === "QUICK") {
      void performLeave();
      return;
    }

    setLeaveConfirmOpen(true);
  };

  const submitSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!backendToken || !preview || !isOwner) {
      return;
    }

    if (settingsPasscodeDirty && settingsForm.passcode.trim().length < 4) {
      toast.error("Passcode must be at least 4 characters");
      return;
    }

    setRoomActionLoading(true);
    try {
      const updated = await updateRoom(backendToken, roomId, {
        title: settingsForm.title.trim(),
        description: settingsForm.description.trim() || null,
        expiresAt: preview.roomType === "GROUP"
          ? null
          : settingsForm.expiresAt
          ? new Date(settingsForm.expiresAt).toISOString()
          : null,
        ...(settingsPasscodeDirty
          ? { passcode: settingsForm.passcode.trim() }
          : {})
      });

      setPreview((current) =>
        current
          ? {
              ...current,
              title: updated.title,
              description: updated.description,
              expiresAt: updated.expiresAt,
              hasPasscode: Boolean(updated.passcode)
            }
          : current
      );
      toast.success("Room updated");
      setSettingsOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to update room");
    } finally {
      setRoomActionLoading(false);
    }
  };

  const archiveRoom = async () => {
    if (!backendToken || !isOwner) {
      return;
    }

    setRoomActionLoading(true);
    try {
      await deleteRoom(backendToken, roomId);
      toast.success("Room archived");
      window.location.href = "/dashboard";
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to archive room");
    } finally {
      setRoomActionLoading(false);
    }
  };

  const confirmRemoveMember = async () => {
    if (!removeTarget) {
      return;
    }

    setRoomActionLoading(true);
    try {
      await removeChatMember(roomId, removeTarget.id);
      setMembers((current) => current.filter((item) => item.id !== removeTarget.id));
      toast.success("Member removed");
      setRemoveTarget(null);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Unable to remove member");
    } finally {
      setRoomActionLoading(false);
    }
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
          canManage={isOwner}
          members={members}
          onRemove={setRemoveTarget}
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

  if (
    preview.roomType === "GROUP" &&
    backendToken &&
    !participant &&
    !groupMembershipChecked
  ) {
    return (
      <StatusPanel
        description="Checking your room membership before opening the chat."
        icon={Loader2}
        title="Opening chat"
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
        defaultName={user?.name ?? ""}
        defaultPasscode={joinPasscodeHint}
        hasPasscode={preview.hasPasscode}
        joining={joining}
        onJoin={handleJoin}
        open={showJoinDialog}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 backdrop-blur-xl sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild aria-label="Back to home" size="icon" variant="ghost">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
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
            <div
              className={cn(
                "grid size-10 place-items-center rounded-2xl border",
                preview.roomType === "QUICK"
                  ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-300"
                  : "border-violet-300/25 bg-violet-300/10 text-violet-300"
              )}
            >
              {preview.roomType === "QUICK" ? (
                <Sparkles className="size-5" />
              ) : (
                <Shield className="size-5" />
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
                {isOwner ? <Badge variant="accent">Owner</Badge> : null}
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {onlineParticipants.size} online
                </span>
                <span className="hidden text-xs text-muted-foreground md:inline">
                  {members.length} members
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Countdown preview={preview} />
            <Button
              aria-label={isOwner ? "Room settings" : "Room info"}
              onClick={() => setSettingsOpen(true)}
              size="icon"
              type="button"
              variant="outline"
            >
              <Settings aria-hidden="true" />
            </Button>
            <Button
              aria-label="Share room link"
              onClick={() => setQrOpen(true)}
              type="button"
              variant="outline"
            >
              <Share2 aria-hidden="true" />
              <span className="hidden sm:inline">Share Link</span>
            </Button>
            <Button
              aria-label="Leave room"
              onClick={requestLeaveRoom}
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

      <Dialog
        onOpenChange={(open) => {
          setQrOpen(open);
          if (!open) {
            setShareMode("link");
          }
        }}
        open={qrOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Invite others to join this {preview.roomType === "GROUP" ? "group" : "room"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => setShareMode("link")}
              type="button"
              variant={shareMode === "link" ? "default" : "outline"}
            >
              <Share2 aria-hidden="true" /> Share Link
            </Button>
            <Button
              onClick={() => setShareMode("qr")}
              type="button"
              variant={shareMode === "qr" ? "default" : "outline"}
            >
              <QrCode aria-hidden="true" /> QR
            </Button>
          </div>
          {shareMode === "link" ? (
            <div className="grid gap-3">
              <div className="break-words rounded-2xl border border-border bg-secondary/40 p-3 text-sm leading-6">
                {shareText(preview)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => openShareUrl("whatsapp", preview)} type="button" variant="outline">
                  <MessageCircle aria-hidden="true" /> WhatsApp
                </Button>
                <Button onClick={() => openShareUrl("telegram", preview)} type="button" variant="outline">
                  <Send aria-hidden="true" /> Telegram
                </Button>
                <Button onClick={() => void shareToInstagram(preview)} type="button" variant="outline">
                  <Share2 aria-hidden="true" /> Instagram
                </Button>
                <Button onClick={() => void navigator.clipboard.writeText(roomUrl(roomId)).then(() => toast.success("Room link copied"))} type="button" variant="outline">
                  <Copy aria-hidden="true" /> Copy Link
                </Button>
              </div>
            </div>
          ) : (
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
          )}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setSettingsOpen} open={settingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOwner ? "Room settings" : "Room info"}</DialogTitle>
            <DialogDescription>
              {isOwner
                ? "Update room details, share access, or archive the room."
                : "View room details, copy the invite link, or leave the room."}
            </DialogDescription>
          </DialogHeader>
          {isOwner ? (
            <form className="grid gap-4" onSubmit={submitSettings}>
              <div className="grid gap-2">
                <Label htmlFor="settingsTitle">Title</Label>
                <Input
                  id="settingsTitle"
                  maxLength={120}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                  required
                  value={settingsForm.title}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="settingsDescription">Description</Label>
                <Textarea
                  id="settingsDescription"
                  maxLength={1000}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      description: event.target.value
                    }))
                  }
                  value={settingsForm.description}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {preview.roomType === "GROUP" ? (
                  <div className="grid gap-2 rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
                    <span className="text-muted-foreground">Expiry</span>
                    <span>Permanent</span>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="settingsExpiry">Expiry</Label>
                    <Input
                      id="settingsExpiry"
                      onChange={(event) =>
                        setSettingsForm((current) => ({
                          ...current,
                          expiresAt: event.target.value
                        }))
                      }
                      type="datetime-local"
                      value={settingsForm.expiresAt}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="settingsPasscode">Passcode</Label>
                  <Input
                    id="settingsPasscode"
                    maxLength={64}
                    minLength={settingsForm.passcode ? 4 : undefined}
                    onChange={(event) => {
                      setSettingsPasscodeDirty(true);
                      setSettingsForm((current) => ({
                        ...current,
                        passcode: event.target.value
                      }));
                    }}
                    placeholder={preview.hasPasscode ? "Unchanged" : "Required passcode"}
                    value={settingsForm.passcode}
                  />
                  <p className="text-xs text-muted-foreground">
                    Every room stays protected by a passcode.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 rounded-2xl border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Invite</span>
                  <Button onClick={() => setQrOpen(true)} size="sm" type="button" variant="outline">
                    <Share2 aria-hidden="true" /> Share Link
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Copy</span>
                  <Button onClick={copyLink} size="sm" type="button" variant="outline">
                    <Copy aria-hidden="true" /> Copy Link
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={roomActionLoading}
                  onClick={archiveRoom}
                  type="button"
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" /> Archive Room
                </Button>
                <Button disabled={roomActionLoading} type="submit">
                  <Edit3 aria-hidden="true" /> Save Changes
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-2xl border border-border bg-secondary/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Type</span>
                  <span>{preview.roomType === "QUICK" ? "Quick Room" : "Group"}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Members</span>
                  <span>{members.length}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Online</span>
                  <span>{onlineParticipants.size}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Expiry</span>
                  <span className="text-right">{roomExpiryText(preview)}</span>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => setQrOpen(true)} type="button" variant="outline">
                  <Share2 aria-hidden="true" /> Share Link
                </Button>
                <Button onClick={copyLink} type="button" variant="outline">
                  <Copy aria-hidden="true" /> Copy Link
                </Button>
              </div>
              <Button onClick={requestLeaveRoom} type="button" variant="destructive">
                <LogOut aria-hidden="true" /> Leave Room
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setLeaveConfirmOpen} open={leaveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave room</DialogTitle>
            <DialogDescription>
              You will be removed from this group and returned to your dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={roomActionLoading}
              onClick={() => void performLeave()}
              type="button"
              variant="destructive"
            >
              Leave Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setRemoveTarget(null)} open={Boolean(removeTarget)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              {`Remove ${removeTarget?.displayName ?? "this member"} from the room?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={roomActionLoading}
              onClick={confirmRemoveMember}
              type="button"
              variant="destructive"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
