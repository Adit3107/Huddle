import { auth } from "@/auth";

export async function getCurrentSession() {
  return auth();
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
