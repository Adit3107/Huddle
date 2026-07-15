"use client";

import { LogIn, LogOut } from "lucide-react";
import { SignOutButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { Button, type ButtonProps } from "@/components/ui/button";

export function LoginButton({
  className,
  size = "default",
  variant = "default"
}: Pick<ButtonProps, "className" | "size" | "variant">) {
  const { isLoaded } = useAuth();

  return (
    <Button
      asChild
      className={className}
      data-disabled={!isLoaded}
      size={size}
      variant={variant}
    >
      <Link aria-disabled={!isLoaded} href="/sign-in">
        <LogIn aria-hidden="true" size={16} />
        Sign in
      </Link>
    </Button>
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
