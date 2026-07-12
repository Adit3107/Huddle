import type { NextRequest } from "next/server";
import { proxyRoomRequest } from "../proxy";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyRoomRequest(request, `/api/rooms/${id}`, "PATCH");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyRoomRequest(request, `/api/rooms/${id}`, "DELETE");
}
