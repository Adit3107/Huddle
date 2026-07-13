"use client";

import { LogIn, LogOut } from "lucide-react";
import { SignInButton, SignOutButton, useAuth } from "@clerk/nextjs";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LoginButton({
  className,
  size = "default",
  variant = "default"
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  const { isLoaded } = useAuth();

  return (
    <SignInButton fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard" mode="modal">
      <Button
        className={className}
        disabled={!isLoaded}
        size={size}
        type="button"
        variant={variant}
      >
        <LogIn aria-hidden="true" size={16} />
        Sign in with Google
      </Button>
    </SignInButton>
  );
}

export function LogoutButton({
  className,
  size = "default",
  variant = "outline"
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  const { isLoaded } = useAuth();

  return (
    <SignOutButton redirectUrl="/">
      <Button
        className={className}
        disabled={!isLoaded}
        size={size}
        type="button"
        variant={variant}
      >
        <LogOut aria-hidden="true" size={16} />
        Logout
      </Button>
    </SignOutButton>
  );
}
