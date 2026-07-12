import type { NextRequest } from "next/server";
import { proxyRoomRequest } from "./proxy";

export function GET(request: NextRequest) {
  return proxyRoomRequest(request, "/api/rooms", "GET");
}

export function POST(request: NextRequest) {
  return proxyRoomRequest(request, "/api/rooms", "POST");
}
