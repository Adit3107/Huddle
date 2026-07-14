import type { NextRequest } from "next/server";
import { proxyChatJson } from "../../proxy";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyChatJson(request, `/api/rooms/${id}/members`, "GET");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const memberId = request.nextUrl.searchParams.get("memberId");
  const path = memberId
    ? `/api/rooms/${id}/members/${memberId}`
    : `/api/rooms/${id}/members/me`;

  return proxyChatJson(request, path, "DELETE");
}
