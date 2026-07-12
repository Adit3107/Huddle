import type { NextRequest } from "next/server";
import { proxyChatJson } from "../../proxy";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyChatJson(request, `/api/rooms/${id}/preview`, "GET");
}
