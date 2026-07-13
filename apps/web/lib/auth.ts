import { currentUser } from "@clerk/nextjs/server";
import { getBackendUrl } from "@/lib/rooms";

interface BackendUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

interface BackendLoginSuccess {
  success: true;
  data: {
    user: BackendUser;
    token: string;
  };
}

interface BackendLoginError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type BackendLoginResponse = BackendLoginSuccess | BackendLoginError;

export interface HuddleSession {
  backendToken: string;
  user: BackendUser;
}

async function loginWithBackend(profile: {
  email: string;
  name: string;
  image: string | null;
  providerId: string;
}) {
  const response = await fetch(`${getBackendUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile),
    cache: "no-store"
  });

  const payload = (await response.json()) as BackendLoginResponse;

  if (!response.ok || !payload.success) {
    const message =
      payload.success === false
        ? payload.error.message
        : "Backend authentication failed.";

    throw new Error(message);
  }

  return payload.data;
}

export async function getCurrentSession(): Promise<HuddleSession | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses.at(0)?.emailAddress;

  if (!email) {
    return null;
  }

  const name =
    clerkUser.fullName ??
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ??
    email;

  const backendSession = await loginWithBackend({
    email,
    name: name || email,
    image: clerkUser.imageUrl || null,
    providerId: clerkUser.id
  });

  return {
    backendToken: backendSession.token,
    user: backendSession.user
  };
}

export async function getBackendToken() {
  const session = await getCurrentSession();
  return session?.backendToken ?? null;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const token = await getBackendToken();

  if (!token) {
    throw new Error("Backend JWT is missing from the current session.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers
  });
}
