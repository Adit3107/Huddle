import { NextResponse, type NextRequest } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getBackendUrl } from "@/lib/rooms";

type ProxyMethod = "GET" | "POST" | "PATCH" | "DELETE";

export async function proxyRoomRequest(
  request: NextRequest,
  path: string,
  method: ProxyMethod
) {
  const incomingAuthorization = request.headers.get("authorization");
  const session = incomingAuthorization ? null : await getCurrentSession();
  const authorization =
    incomingAuthorization ??
    (session?.backendToken ? `Bearer ${session.backendToken}` : null);

  if (!authorization) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication is required."
        }
      },
      { status: 401 }
    );
  }

  const headers = new Headers();
  headers.set("Authorization", authorization);

  let body: string | undefined;

  if (method === "POST" || method === "PATCH") {
    body = await request.text();
    headers.set("Content-Type", "application/json");
  }

  const targetUrl = new URL(`${getBackendUrl()}${path}`);
  targetUrl.search = request.nextUrl.search;

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

  const contentType = response.headers.get("content-type");
  const payload = contentType?.includes("application/json")
    ? ((await response.json()) as unknown)
    : {
        success: false,
        error: {
          code: "BACKEND_RESPONSE_INVALID",
          message: "Backend returned an unexpected response."
        }
      };

  return NextResponse.json(payload, { status: response.status });
}
