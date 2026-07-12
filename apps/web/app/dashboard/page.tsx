import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { getCurrentSession } from "@/lib/auth";
import { listRooms } from "@/lib/rooms";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session?.backendToken) {
    redirect("/");
  }

  const rooms = await listRooms(session.backendToken).catch(() => []);

  return (
    <DashboardClient
      initialRooms={rooms}
      session={session}
      token={session.backendToken}
    />
  );
}
