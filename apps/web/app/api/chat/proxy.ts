import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getBackendUrl } from "@/lib/rooms";

export async function proxyChatJson(
  request: NextRequest,
  path: string,
  method: "GET" | "POST"
) {
  const session = await auth();
  const headers = new Headers();
  const participantId = request.nextUrl.searchParams.get("participantId");

  if (session?.backendToken) {
    headers.set("Authorization", `Bearer ${session.backendToken}`);
  }

  if (participantId) {
    headers.set("X-Participant-Id", participantId);
  }

  let body: string | undefined;

  if (method === "POST") {
    body = await request.text();
    headers.set("Content-Type", "application/json");
  }

  const targetUrl = new URL(`${getBackendUrl()}${path}`);

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    targetUrl.searchParams.set(key, value);
  }

  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message:
            "Backend is unavailable. Start the server dependencies and try again."
        }
      },
      { status: 503 }
    );
  }

  const payload = (await response.json()) as unknown;
  return NextResponse.json(payload, { status: response.status });
}

export async function proxyChatUpload(request: NextRequest, roomId: string) {
  const session = await auth();
  const headers = new Headers();
  const participantId = request.nextUrl.searchParams.get("participantId");
  const targetUrl = new URL(`${getBackendUrl()}/api/upload/rooms/${roomId}`);

  if (session?.backendToken) {
    headers.set("Authorization", `Bearer ${session.backendToken}`);
  }

  if (participantId) {
    headers.set("X-Participant-Id", participantId);
    targetUrl.searchParams.set("participantId", participantId);
  }

  let response: Response;

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: await request.formData(),
      cache: "no-store"
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message:
            "Backend is unavailable. Start the server dependencies and try again."
        }
      },
      { status: 503 }
    );
  }

  const payload = (await response.json()) as unknown;
  return NextResponse.json(payload, { status: response.status });
}
