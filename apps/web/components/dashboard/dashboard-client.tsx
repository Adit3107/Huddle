"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarClock,
  Copy,
  DoorOpen,
  Edit3,
  LayoutGrid,
  Link as LinkIcon,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Send,
  Settings,
  Share2,
  Trash2,
  UsersRound,
  Zap
} from "lucide-react";
import QRCode from "qrcode";
import { useClerk } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  createRoom,
  deleteRoom,
  formatDate,
  getRoomAnalytics,
  isRoomOwner,
  listRooms,
  roomInvitePath,
  roomInviteUrl,
  roomStatus,
  type CreateRoomPayload,
  type HuddleRoom,
  type RoomAnalytics,
  type RoomType,
  updateRoom
} from "@/lib/rooms";
import { leaveChatRoom } from "@/lib/chat";
import { cn } from "@/lib/utils";

type DialogMode = "create" | "edit" | null;
type ShareMode = "link" | "qr";

interface RoomFormState {
  title: string;
  roomType: RoomType;
  description: string;
  expiresAt: string;
  passcode: string;
}

interface DashboardSession {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
  };
}

const emptyForm: RoomFormState = {
  title: "",
  roomType: "QUICK",
  description: "",
  expiresAt: "",
  passcode: ""
};

function toDatetimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function roomExpiryText(room: Pick<HuddleRoom, "roomType" | "expiresAt">) {
  return room.roomType === "GROUP" ? "Permanent" : formatDate(room.expiresAt);
}

function shareText(room: HuddleRoom) {
  const ownerName = room.owner?.name ?? "a HUDDLE user";
  const noun = room.roomType === "GROUP" ? "group" : "room";
  return `Join ${ownerName}'s ${noun} "${room.title}" on HUDDLE: ${roomInviteUrl(room.id)}`;
}

async function copyShareText(room: HuddleRoom) {
  await navigator.clipboard.writeText(shareText(room));
  toast.success("Share message copied");
}

function openShareUrl(kind: "whatsapp" | "telegram", room: HuddleRoom) {
  const text = encodeURIComponent(shareText(room));
  const url =
    kind === "whatsapp"
      ? `https://wa.me/?text=${text}`
      : `https://t.me/share/url?url=${encodeURIComponent(roomInviteUrl(room.id))}&text=${encodeURIComponent(
          shareText(room).replace(roomInviteUrl(room.id), "").trim()
        )}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

async function shareToInstagram(room: HuddleRoom) {
  if (navigator.share) {
    await navigator.share({
      title: room.title,
      text: shareText(room),
      url: roomInviteUrl(room.id)
    });
    return;
  }

  await copyShareText(room);
  toast.info("Paste the copied invite into Instagram");
}

function StatCard({
  label,
  value,
  icon: Icon
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className="size-4 text-emerald-300" />
      <p className="mt-4 text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton className="h-72" key={index} />
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="grid min-h-80 place-items-center rounded-[2rem] border border-dashed border-border bg-card/50 p-8 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary">
          <LayoutGrid aria-hidden="true" className="size-5 text-emerald-300" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold">No rooms found</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Create a quick room for an immediate session or a group room for
          recurring collaboration.
        </p>
        <Button className="mt-6" onClick={onCreate} type="button">
          <Plus aria-hidden="true" /> Create room
        </Button>
      </div>
    </div>
  );
}

function RoomCard({
  room,
  onAnalytics,
  onDelete,
  onEdit,
  onLeave,
  onOpenChat,
  onQr,
  userId
}: {
  room: HuddleRoom;
  onAnalytics: (room: HuddleRoom) => void;
  onDelete: (room: HuddleRoom) => void;
  onEdit: (room: HuddleRoom) => void;
  onLeave: (room: HuddleRoom) => void;
  onOpenChat: (room: HuddleRoom) => void;
  onQr: (room: HuddleRoom) => void;
  userId: string;
}) {
  const owner = room.owner?.name ?? "Owner";
  const status = roomStatus(room);
  const isOwner = isRoomOwner(room, userId);
  const isQuickRoom = room.roomType === "QUICK";
  const typeLabel = isQuickRoom ? "Quick Room" : "Group";
  const tone = isQuickRoom
    ? {
        card:
          "border-emerald-300/25 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(16,185,129,0.04)_44%,hsl(var(--card))_100%)] hover:border-emerald-300/50 hover:shadow-emerald-950/20",
        icon: "border-emerald-300/25 bg-emerald-300/10 text-emerald-300",
        strip: "from-emerald-300/70 via-emerald-400/30 to-transparent",
        cta: "bg-emerald-300 text-zinc-950 hover:bg-emerald-200",
        outline: "border-emerald-300/25 hover:bg-emerald-300/10"
      }
    : {
        card:
          "border-violet-300/25 bg-[linear-gradient(135deg,rgba(139,92,246,0.18),rgba(168,85,247,0.05)_44%,hsl(var(--card))_100%)] hover:border-violet-300/50 hover:shadow-violet-950/20",
        icon: "border-violet-300/25 bg-violet-300/10 text-violet-300",
        strip: "from-violet-300/70 via-fuchsia-400/25 to-transparent",
        cta: "bg-violet-300 text-zinc-950 hover:bg-violet-200",
        outline: "border-violet-300/25 hover:bg-violet-300/10"
      };
  const TypeIcon = isQuickRoom ? Zap : UsersRound;

  const copyPasscode = async () => {
    if (!room.passcode) {
      toast.error("This room does not have a passcode");
      return;
    }

    await navigator.clipboard.writeText(room.passcode);
    toast.success("Room passcode copied");
  };

  const stop = (event: React.MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <motion.article
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[1.75rem] border p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-2xl",
        tone.card
      )}
      layout
      onClick={() => onOpenChat(room)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenChat(room);
        }
      }}
      role="button"
      tabIndex={0}
      transition={{ duration: 0.2 }}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          tone.strip
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl border",
              tone.icon
            )}
          >
            <TypeIcon aria-hidden="true" className="size-5" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={isQuickRoom ? "accent" : "secondary"}>{typeLabel}</Badge>
            <Badge variant={status === "Active" ? "outline" : "secondary"}>
              {status}
            </Badge>
            <Badge variant="outline">Protected</Badge>
            {isOwner ? <Badge variant="accent">Owner</Badge> : null}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Room actions"
              onClick={stop}
              size="icon"
              variant="ghost"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stop}>
            <DropdownMenuLabel>Room actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onOpenChat(room)}>
              <ArrowRight aria-hidden="true" className="size-4" /> Open chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQr(room)}>
              <Share2 aria-hidden="true" className="size-4" /> Share link
            </DropdownMenuItem>
            {isOwner && room.passcode ? (
              <DropdownMenuItem onClick={() => void copyPasscode()}>
                <LinkIcon aria-hidden="true" className="size-4" /> Copy passcode
              </DropdownMenuItem>
            ) : null}
            {isOwner ? (
              <>
                <DropdownMenuSeparator className="-mx-2 my-2 h-px bg-border" />
                <DropdownMenuItem onClick={() => onEdit(room)}>
                  <Edit3 aria-hidden="true" className="size-4" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAnalytics(room)}>
                  <BarChart3 aria-hidden="true" className="size-4" /> Analytics
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(room)}
                >
                  <Trash2 aria-hidden="true" className="size-4" /> Delete
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onLeave(room)}
              >
                <LogOut aria-hidden="true" className="size-4" /> Leave room
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <h3 className="mt-5 line-clamp-2 text-xl font-semibold tracking-normal">
        {room.title}
      </h3>
      <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
        {room.description || "No description yet."}
      </p>
      <div className="mt-6 grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UsersRound aria-hidden="true" className="size-4" /> Owner
          </span>
          <span className="truncate text-right">{owner}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CalendarClock aria-hidden="true" className="size-4" /> Created
          </span>
          <span className="text-right">{formatDate(room.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Activity aria-hidden="true" className="size-4" /> Expiry
          </span>
          <span className="text-right">{roomExpiryText(room)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UsersRound aria-hidden="true" className="size-4" /> Participants
          </span>
          <span>{room._count.members}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Zap aria-hidden="true" className="size-4" /> Online
          </span>
          <span>0</span>
        </div>
        {isOwner ? (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <LinkIcon aria-hidden="true" className="size-4" /> Passcode
            </span>
            <span className="truncate text-right">{room.passcode}</span>
          </div>
        ) : null}
      </div>
      <Separator className="my-5" />
      <div className="grid grid-cols-2 gap-2">
        <Button
          className={cn("col-span-2", tone.cta)}
          onClick={(event) => {
            stop(event);
            onOpenChat(room);
          }}
          size="sm"
          type="button"
        >
          <ArrowRight aria-hidden="true" /> Open Chat
        </Button>
        <Button
          aria-label="Share room link"
          className={cn("col-span-2", tone.outline)}
          onClick={(event) => {
            stop(event);
            onQr(room);
          }}
          size="sm"
          variant="outline"
        >
          <Share2 aria-hidden="true" /> Share Link
        </Button>
        {isOwner ? (
          <>
            <Button aria-label="Show analytics" className={tone.outline} onClick={(event) => { stop(event); onAnalytics(room); }} size="sm" variant="outline">
              <BarChart3 aria-hidden="true" />
            </Button>
            <Button aria-label="Edit room" className={tone.outline} onClick={(event) => { stop(event); onEdit(room); }} size="sm" variant="outline">
              <Edit3 aria-hidden="true" />
            </Button>
          </>
        ) : (
          <Button
            className={cn("col-span-2", tone.outline)}
            onClick={(event) => {
              stop(event);
              onLeave(room);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            <LogOut aria-hidden="true" /> Leave Room
          </Button>
        )}
      </div>
    </motion.article>
  );
}

export function DashboardClient({
  initialRooms,
  session,
  token
}: {
  initialRooms: HuddleRoom[];
  session: DashboardSession;
  token: string;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [rooms, setRooms] = useState(initialRooms);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | RoomType>("ALL");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedRoom, setSelectedRoom] = useState<HuddleRoom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HuddleRoom | null>(null);
  const [analyticsTarget, setAnalyticsTarget] = useState<HuddleRoom | null>(null);
  const [analytics, setAnalytics] = useState<RoomAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [qrTarget, setQrTarget] = useState<HuddleRoom | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [shareMode, setShareMode] = useState<ShareMode>("link");
  const [leaveTarget, setLeaveTarget] = useState<HuddleRoom | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinValue, setJoinValue] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");
  const [form, setForm] = useState<RoomFormState>(emptyForm);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesTab = activeTab === "ALL" || room.roomType === activeTab;
      const matchesQuery =
        !normalized ||
        room.title.toLowerCase().includes(normalized) ||
        room.description?.toLowerCase().includes(normalized) ||
        room.id.toLowerCase().includes(normalized) ||
        room.owner?.name.toLowerCase().includes(normalized) ||
        room.owner?.email.toLowerCase().includes(normalized) ||
        room.roomType.toLowerCase().includes(normalized);

      return matchesTab && matchesQuery;
    });
  }, [activeTab, query, rooms]);

  const refreshRooms = async () => {
    setLoading(true);
    try {
      setRooms(await listRooms(token));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load rooms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!analyticsTarget) {
      setAnalytics(null);
      return;
    }

    setAnalyticsLoading(true);
    getRoomAnalytics(token, analyticsTarget.id)
      .then(setAnalytics)
      .catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Unable to load analytics"
        );
      })
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsTarget, token]);

  useEffect(() => {
    if (!qrTarget) {
      setQrDataUrl("");
      return;
    }

    QRCode.toDataURL(roomInviteUrl(qrTarget.id), {
      margin: 2,
      width: 320,
      color: {
        dark: "#09090b",
        light: "#ffffff"
      }
    })
      .then(setQrDataUrl)
      .catch(() => toast.error("Unable to generate QR code"));
  }, [qrTarget]);

  const openCreate = () => {
    setSelectedRoom(null);
    setForm(emptyForm);
    setDialogMode("create");
  };

  const openChat = (room: HuddleRoom) => {
    router.push(roomInvitePath(room.id));
  };

  const parseJoinRoomId = () => {
    const value = joinValue.trim();

    if (!value) {
      return null;
    }

    try {
      const url = new URL(value);
      const match = url.pathname.match(/\/chat\/([^/]+)/);
      return match?.[1] ?? null;
    } catch {
      const match = value.match(/(?:chat\/)?([a-z0-9]{10,})/i);
      return match?.[1] ?? value;
    }
  };

  const submitJoin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const roomId = parseJoinRoomId();

    if (!roomId) {
      toast.error("Enter a room link or room ID");
      return;
    }

    if (joinPasscode.trim()) {
      window.sessionStorage.setItem(
        `huddle:join:${roomId}:passcode`,
        joinPasscode.trim()
      );
    }

    toast.success("Opening room");
    setJoinDialogOpen(false);
    router.push(roomInvitePath(roomId));
  };

  const openEdit = (room: HuddleRoom) => {
    setSelectedRoom(room);
    setForm({
      title: room.title,
      roomType: room.roomType,
      description: room.description ?? "",
      expiresAt: toDatetimeLocal(room.expiresAt),
      passcode: room.passcode ?? ""
    });
    setDialogMode("edit");
  };

  const submitRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.title.trim()) {
      toast.error("Room title is required");
      return;
    }

    if (form.passcode.trim().length < 4) {
      toast.error("Passcode must be at least 4 characters");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateRoomPayload = {
        title: form.title.trim(),
        roomType: form.roomType,
        description: form.description.trim() || null,
        expiresAt: form.roomType === "GROUP" ? null : toIsoOrNull(form.expiresAt),
        passcode: form.passcode.trim()
      };

      if (dialogMode === "edit" && selectedRoom) {
        const updated = await updateRoom(token, selectedRoom.id, {
          title: payload.title,
          description: payload.description,
          expiresAt: payload.expiresAt,
          passcode: payload.passcode
        });
        setRooms((current) =>
          current.map((room) => (room.id === updated.id ? updated : room))
        );
        toast.success("Room updated");
      } else {
        const created = await createRoom(token, payload);
        setRooms((current) => [created, ...current]);
        toast.success("Room created");
      }

      setDialogMode(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Room request failed");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setSubmitting(true);
    try {
      await deleteRoom(token, deleteTarget.id);
      setRooms((current) => current.filter((room) => room.id !== deleteTarget.id));
      toast.success("Room deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete room");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmLeave = async () => {
    if (!leaveTarget) {
      return;
    }

    setSubmitting(true);
    try {
      await leaveChatRoom(leaveTarget.id);
      setRooms((current) => current.filter((room) => room.id !== leaveTarget.id));
      toast.success("Left room");
      setLeaveTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to leave room");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="aurora-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <Button asChild aria-label="Back to home" size="icon" variant="ghost">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
              </Link>
            </Button>
            <div className="grid size-9 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
              <LayoutGrid aria-hidden="true" className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.18em]">HUDDLE</p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Workspace dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              className="hidden sm:inline-flex"
              onClick={() => setJoinDialogOpen(true)}
              type="button"
              variant="outline"
            >
              <DoorOpen aria-hidden="true" /> Join Room
            </Button>
            <ThemeToggle />
            <div className="hidden min-w-0 text-right sm:block">
              <span className="block truncate text-sm font-medium">
                {session.user.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {session.user.email}
              </span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Open profile menu"
                  className="size-9 overflow-hidden rounded-full p-0"
                  type="button"
                  variant="ghost"
                >
                  {session.user.image ? (
                    // Clerk avatars can come from multiple hosts; keep this
                    // menu image unoptimized so dashboard render is reliable.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt=""
                      className="size-9 object-cover"
                      src={session.user.image}
                    />
                  ) : (
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">
                      {session.user.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <span className="block truncate">{session.user.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {session.user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="-mx-2 my-2 h-px bg-border" />
                <DropdownMenuItem onClick={() => toast.info("Profile is managed by Clerk")}>
                  <UsersRound aria-hidden="true" className="size-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab("ALL")}>
                  <LayoutGrid aria-hidden="true" className="size-4" /> My Rooms
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Settings are coming soon")}>
                  <Settings aria-hidden="true" className="size-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Use the theme toggle beside your profile")}>
                  <Activity aria-hidden="true" className="size-4" /> Theme
                </DropdownMenuItem>
                <DropdownMenuSeparator className="-mx-2 my-2 h-px bg-border" />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void signOut({ redirectUrl: "/" })}
                >
                  <LogOut aria-hidden="true" className="size-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <section className="relative mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="accent">Authenticated workspace</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-5xl">
              Rooms before chat.
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Create, organize, share, and inspect the collaboration rooms that
              power HUDDLE.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setJoinDialogOpen(true)} size="lg" type="button" variant="outline">
              <DoorOpen aria-hidden="true" /> Join Room
            </Button>
            <Button onClick={openCreate} size="lg" type="button">
              <Plus aria-hidden="true" /> Create room
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <StatCard
            icon={LayoutGrid}
            label="Total rooms"
            value={rooms.length}
          />
          <StatCard
            icon={Zap}
            label="Quick rooms"
            value={rooms.filter((room) => room.roomType === "QUICK").length}
          />
          <StatCard
            icon={UsersRound}
            label="Groups"
            value={rooms.filter((room) => room.roomType === "GROUP").length}
          />
        </div>

        <div className="mt-8 rounded-[2rem] border border-border bg-card/70 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                aria-hidden="true"
                className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Search rooms"
                className="pl-11"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, owner, ID, or type"
                value={query}
              />
            </div>
            <Button onClick={refreshRooms} type="button" variant="outline">
              Refresh
            </Button>
          </div>

          <Tabs
            className="mt-6"
            onValueChange={(value) => setActiveTab(value as "ALL" | RoomType)}
            value={activeTab}
          >
            <TabsList>
              <TabsTrigger value="ALL">All</TabsTrigger>
              <TabsTrigger value="QUICK">Quick Rooms</TabsTrigger>
              <TabsTrigger value="GROUP">Groups</TabsTrigger>
            </TabsList>
            {(["ALL", "QUICK", "GROUP"] as const).map((tab) => (
              <TabsContent key={tab} value={tab}>
                {loading ? (
                  <DashboardSkeleton />
                ) : filteredRooms.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredRooms.map((room) => (
                      <RoomCard
                        key={room.id}
                        onAnalytics={setAnalyticsTarget}
                        onDelete={setDeleteTarget}
                        onEdit={openEdit}
                        onLeave={setLeaveTarget}
                        onOpenChat={openChat}
                        onQr={setQrTarget}
                        room={room}
                        userId={session.user.id}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState onCreate={openCreate} />
                )}
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <Dialog onOpenChange={(open) => !open && setDialogMode(null)} open={Boolean(dialogMode)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? "Edit room" : "Create room"}
            </DialogTitle>
            <DialogDescription>
              Configure the room surface. Chat and realtime messaging are not
              part of this section.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitRoom}>
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                maxLength={120}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                required
                value={form.title}
              />
            </div>
            <div className="grid gap-2">
              <Label>Room type</Label>
              <Select
                disabled={dialogMode === "edit"}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    roomType: value as RoomType,
                    expiresAt: value === "GROUP" ? "" : current.expiresAt
                  }))
                }
                value={form.roomType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose room type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUICK">Quick Room</SelectItem>
                  <SelectItem value="GROUP">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                maxLength={1000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value
                  }))
                }
                value={form.description}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expiresAt">
                  {form.roomType === "GROUP" ? "Expiry" : "Expiry"}
                </Label>
                <Input
                  disabled={form.roomType === "GROUP"}
                  id="expiresAt"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      expiresAt: event.target.value
                    }))
                  }
                  type="datetime-local"
                  value={form.expiresAt}
                />
                {form.roomType === "GROUP" ? (
                  <p className="text-xs text-muted-foreground">
                    Groups are permanent.
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  maxLength={64}
                  minLength={4}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      passcode: event.target.value
                    }))
                  }
                  placeholder="Required for every room"
                  required
                  value={form.passcode}
                />
                <p className="text-xs text-muted-foreground">
                  Required for Quick Rooms and Groups.
                </p>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={submitting} type="submit">
                {dialogMode === "edit" ? "Save changes" : "Create room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setDeleteTarget(null)} open={Boolean(deleteTarget)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete room</DialogTitle>
            <DialogDescription>
              {`This archives "${deleteTarget?.title ?? "this room"}" and removes it from the dashboard.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              disabled={submitting}
              onClick={confirmDelete}
              type="button"
              variant="destructive"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setLeaveTarget(null)} open={Boolean(leaveTarget)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave room</DialogTitle>
            <DialogDescription>
              {`You will no longer see "${leaveTarget?.title ?? "this room"}" on your dashboard.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={submitting} onClick={confirmLeave} type="button" variant="destructive">
              Leave Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setJoinDialogOpen} open={joinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join room</DialogTitle>
            <DialogDescription>
              Paste a room link or enter a room ID. Add the passcode if you are
              joining a protected room for the first time.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitJoin}>
            <div className="grid gap-2">
              <Label htmlFor="joinRoom">Room link or ID</Label>
              <Input
                id="joinRoom"
                onChange={(event) => setJoinValue(event.target.value)}
                placeholder="https://.../chat/room-id or room-id"
                value={joinValue}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="joinPasscode">Passcode</Label>
              <Input
                id="joinPasscode"
                maxLength={64}
                onChange={(event) => setJoinPasscode(event.target.value)}
                placeholder="Required for first-time access"
                value={joinPasscode}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">
                <ArrowRight aria-hidden="true" /> Open Room
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setAnalyticsTarget(null)}
        open={Boolean(analyticsTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{analyticsTarget?.title} analytics</DialogTitle>
            <DialogDescription>
              Room-level metrics from the existing backend analytics endpoint.
            </DialogDescription>
          </DialogHeader>
          {analyticsLoading || !analytics ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton className="h-28" key={index} />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard icon={BarChart3} label="Messages" value={analytics.totalMessages} />
              <StatCard icon={UsersRound} label="Participants" value={analytics.participants} />
              <StatCard icon={Activity} label="Online now" value={analytics.onlineUsers} />
              <StatCard icon={LayoutGrid} label="Peak users" value={analytics.peakUsers} />
              <div className="rounded-2xl border border-border bg-card p-4 sm:col-span-2">
                <p className="text-sm text-muted-foreground">Timeline</p>
                <p className="mt-3 text-sm">Created: {formatDate(analytics.createdAt)}</p>
                <p className="mt-2 text-sm">
                  Expiry: {analytics.roomType === "GROUP" ? "Permanent" : formatDate(analytics.expiresAt)}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setQrTarget(null);
            setShareMode("link");
          }
        }}
        open={Boolean(qrTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              {qrTarget
                ? `Invite others to join ${qrTarget.roomType === "GROUP" ? "this group" : "this room"}.`
                : "Invite others to join this room."}
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
          {shareMode === "link" && qrTarget ? (
            <div className="grid gap-3">
              <div className="rounded-2xl border border-border bg-secondary/40 p-3 text-sm leading-6">
                {shareText(qrTarget)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => openShareUrl("whatsapp", qrTarget)} type="button" variant="outline">
                  <MessageCircle aria-hidden="true" /> WhatsApp
                </Button>
                <Button onClick={() => openShareUrl("telegram", qrTarget)} type="button" variant="outline">
                  <Send aria-hidden="true" /> Telegram
                </Button>
                <Button onClick={() => void shareToInstagram(qrTarget)} type="button" variant="outline">
                  <Share2 aria-hidden="true" /> Instagram
                </Button>
                <Button onClick={() => void navigator.clipboard.writeText(roomInviteUrl(qrTarget.id)).then(() => toast.success("Room link copied"))} type="button" variant="outline">
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
                  src={qrDataUrl}
                  unoptimized
                  width={256}
                />
              ) : (
                <Skeleton className="size-64" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
