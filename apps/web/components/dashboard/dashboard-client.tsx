"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Copy,
  Edit3,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  Trash2,
  UsersRound,
  Zap
} from "lucide-react";
import QRCode from "qrcode";
import type { Session } from "next-auth";
import Image from "next/image";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LogoutButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  listRooms,
  type CreateRoomPayload,
  type HuddleRoom,
  type RoomAnalytics,
  type RoomType,
  updateRoom
} from "@/lib/rooms";

type DialogMode = "create" | "edit" | null;

interface RoomFormState {
  title: string;
  roomType: RoomType;
  description: string;
  expiresAt: string;
  passcode: string;
}

const emptyForm: RoomFormState = {
  title: "",
  roomType: "QUICK",
  description: "",
  expiresAt: "",
  passcode: ""
};

function initials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "HD"
  );
}

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

function roomUrl(roomId: string) {
  if (typeof window === "undefined") {
    return `/chat/${roomId}`;
  }

  return `${window.location.origin}/chat/${roomId}`;
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
  onQr
}: {
  room: HuddleRoom;
  onAnalytics: (room: HuddleRoom) => void;
  onDelete: (room: HuddleRoom) => void;
  onEdit: (room: HuddleRoom) => void;
  onQr: (room: HuddleRoom) => void;
}) {
  const copyLink = async () => {
    await navigator.clipboard.writeText(roomUrl(room.id));
    toast.success("Room link copied");
  };

  return (
    <motion.article
      className="group rounded-[1.75rem] border border-border bg-card p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-300/30 hover:shadow-2xl"
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between gap-3">
        <Badge variant={room.roomType === "QUICK" ? "accent" : "secondary"}>
          {room.roomType === "QUICK" ? "Quick Room" : "Group"}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Room actions" size="icon" variant="ghost">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Room actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(room)}>
              <Edit3 aria-hidden="true" className="size-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAnalytics(room)}>
              <BarChart3 aria-hidden="true" className="size-4" /> Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQr(room)}>
              <QrCode aria-hidden="true" className="size-4" /> QR code
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onDelete(room)}
            >
              <Trash2 aria-hidden="true" className="size-4" /> Delete
            </DropdownMenuItem>
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
            <CalendarClock aria-hidden="true" className="size-4" /> Created
          </span>
          <span className="text-right">{formatDate(room.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Activity aria-hidden="true" className="size-4" /> Expiry
          </span>
          <span className="text-right">{formatDate(room.expiresAt)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2 text-muted-foreground">
            <UsersRound aria-hidden="true" className="size-4" /> Participants
          </span>
          <span>{room._count.members}</span>
        </div>
      </div>
      <Separator className="my-5" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button aria-label="Copy room link" onClick={copyLink} size="sm" variant="outline">
          <Copy aria-hidden="true" />
        </Button>
        <Button aria-label="Show QR code" onClick={() => onQr(room)} size="sm" variant="outline">
          <QrCode aria-hidden="true" />
        </Button>
        <Button aria-label="Show analytics" onClick={() => onAnalytics(room)} size="sm" variant="outline">
          <BarChart3 aria-hidden="true" />
        </Button>
        <Button aria-label="Edit room" onClick={() => onEdit(room)} size="sm" variant="outline">
          <Edit3 aria-hidden="true" />
        </Button>
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
  session: Session;
  token: string;
}) {
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
  const [form, setForm] = useState<RoomFormState>(emptyForm);

  const filteredRooms = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rooms.filter((room) => {
      const matchesTab = activeTab === "ALL" || room.roomType === activeTab;
      const matchesQuery =
        !normalized ||
        room.title.toLowerCase().includes(normalized) ||
        room.description?.toLowerCase().includes(normalized);

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

    QRCode.toDataURL(roomUrl(qrTarget.id), {
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

    setSubmitting(true);
    try {
      const payload: CreateRoomPayload = {
        title: form.title.trim(),
        roomType: form.roomType,
        description: form.description.trim() || null,
        expiresAt: toIsoOrNull(form.expiresAt),
        passcode: form.passcode.trim() || null
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

  return (
    <main className="aurora-shell min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
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
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="rounded-full p-0" size="icon" variant="ghost">
                  <Avatar className="size-9">
                    <AvatarImage
                      alt={session.user?.name ?? "Profile"}
                      src={session.user?.image ?? undefined}
                    />
                    <AvatarFallback>{initials(session.user?.name)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <span className="block truncate">{session.user?.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {session.user?.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <div>
                    <LogoutButton className="w-full justify-start" variant="ghost" />
                  </div>
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
          <Button onClick={openCreate} size="lg" type="button">
            <Plus aria-hidden="true" /> Create room
          </Button>
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
                placeholder="Search rooms"
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
                        onQr={setQrTarget}
                        room={room}
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
                    roomType: value as RoomType
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
                <Label htmlFor="expiresAt">Expiry</Label>
                <Input
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
              </div>
              <div className="grid gap-2">
                <Label htmlFor="passcode">Passcode</Label>
                <Input
                  id="passcode"
                  maxLength={64}
                  minLength={form.passcode ? 4 : undefined}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      passcode: event.target.value
                    }))
                  }
                  placeholder="Optional"
                  value={form.passcode}
                />
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
                <p className="mt-2 text-sm">Expiry: {formatDate(analytics.expiresAt)}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setQrTarget(null)} open={Boolean(qrTarget)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR sharing</DialogTitle>
            <DialogDescription>
              {`Scan or copy the room link for "${qrTarget?.title ?? "this room"}".`}
            </DialogDescription>
          </DialogHeader>
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
          <Button
            onClick={() => {
              if (qrTarget) {
                void navigator.clipboard.writeText(roomUrl(qrTarget.id));
                toast.success("Room link copied");
              }
            }}
            type="button"
            variant="outline"
          >
            <Copy aria-hidden="true" /> Copy link
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
