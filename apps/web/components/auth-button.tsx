"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";

export function LoginButton() {
  const { status } = useSession();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status === "loading"}
      onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
      type="button"
    >
      <LogIn aria-hidden="true" size={16} />
      Sign in with Google
    </button>
  );
}

export function LogoutButton() {
  const { status } = useSession();

  return (
    <button
      className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={status === "loading"}
      onClick={() => void signOut({ callbackUrl: "/" })}
      type="button"
    >
      <LogOut aria-hidden="true" size={16} />
      Logout
    </button>
  );
}
