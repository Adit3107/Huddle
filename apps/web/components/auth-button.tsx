"use client";

import { LogIn, LogOut } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LoginButton({
  className,
  size = "default",
  variant = "default"
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  const { status } = useSession();

  return (
    <Button
      className={className}
      disabled={status === "loading"}
      onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
      size={size}
      type="button"
      variant={variant}
    >
      <LogIn aria-hidden="true" size={16} />
      Sign in with Google
    </Button>
  );
}

export function LogoutButton({
  className,
  size = "default",
  variant = "outline"
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  const { status } = useSession();

  return (
    <Button
      className={className}
      disabled={status === "loading"}
      onClick={() => void signOut({ callbackUrl: "/" })}
      size={size}
      type="button"
      variant={variant}
    >
      <LogOut aria-hidden="true" size={16} />
      Logout
    </Button>
  );
}
