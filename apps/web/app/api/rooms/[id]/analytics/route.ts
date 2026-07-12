import type { NextRequest } from "next/server";
import { proxyRoomRequest } from "../../proxy";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyRoomRequest(request, `/api/rooms/${id}/analytics`, "GET");
}
