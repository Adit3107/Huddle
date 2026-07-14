import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getBackendUrl } from "@/lib/rooms";

export async function proxyChatJson(
  request: NextRequest,
  path: string,
  method: "GET" | "POST" | "DELETE"
) {
  const incomingAuthorization = request.headers.get("authorization");
  const session = incomingAuthorization ? null : await getCurrentSession();
  const headers = new Headers();
  const participantId = request.nextUrl.searchParams.get("participantId");
  const authorization =
    incomingAuthorization ??
    (session?.backendToken ? `Bearer ${session.backendToken}` : null);

  if (authorization) {
    headers.set("Authorization", authorization);
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
  const incomingAuthorization = request.headers.get("authorization");
  const session = incomingAuthorization ? null : await getCurrentSession();
  const headers = new Headers();
  const participantId = request.nextUrl.searchParams.get("participantId");
  const targetUrl = new URL(`${getBackendUrl()}/api/upload/rooms/${roomId}`);
  const authorization =
    incomingAuthorization ??
    (session?.backendToken ? `Bearer ${session.backendToken}` : null);

  if (authorization) {
    headers.set("Authorization", authorization);
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
