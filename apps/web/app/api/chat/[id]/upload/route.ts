import type { NextRequest } from "next/server";
import { proxyChatUpload } from "../../proxy";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return proxyChatUpload(request, id);
}
