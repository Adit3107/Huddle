"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  MessageSquareDashed,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth, useSignIn, useSignUp } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "sign-in" | "sign-up";

const highlights = [
  "Quick rooms stay open to guests",
  "Private groups stay protected",
  "Backend roles keep using HUDDLE JWTs"
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.52Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.96-.9 6.62-2.25l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.41 14.08A6.02 6.02 0 0 1 6.1 12c0-.72.11-1.42.31-2.08V7.33H3.07A10 10 0 0 0 2 12c0 1.61.39 3.13 1.07 4.67l3.34-2.59Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.8c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.33l3.34 2.59C7.2 7.56 9.4 5.8 12 5.8Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AuthPanel({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { fetchStatus: signInStatus, signIn } = useSignIn();
  const { fetchStatus: signUpStatus, signUp } = useSignUp();
  const [loading, setLoading] = useState(false);
  const isSignIn = mode === "sign-in";
  const authResource = isSignIn ? signIn : signUp;
  const fetchStatus = isSignIn ? signInStatus : signUpStatus;
  const isLoaded = Boolean(authResource) && fetchStatus === "idle";

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isSignedIn, router]);

  const startGoogle = async () => {
    if (!isLoaded) {
      return;
    }

    setLoading(true);
    try {
      await authResource?.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: isSignIn ? "/sign-in" : "/sign-up",
        redirectUrl: "/sso-callback"
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to start Google authentication"
      );
      setLoading(false);
    }
  };

  return (
    <main className="aurora-shell min-h-screen text-foreground">
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link className="flex min-w-0 items-center gap-3" href="/">
          <span className="grid size-9 shrink-0 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <MessageSquareDashed aria-hidden="true" className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold tracking-[0.18em]">
            HUDDLE
          </span>
        </Link>
        <ThemeToggle />
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:py-16">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left"
          initial={{ opacity: 0, y: 18 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm text-emerald-200 lg:mx-0">
            <Sparkles aria-hidden="true" className="size-4" />
            One workspace, one sign-in flow
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl lg:text-6xl">
            {isSignIn
              ? "Welcome back to focused collaboration."
              : "Create your HUDDLE workspace identity."}
          </h1>
          <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
            Sign in without leaving the product. HUDDLE keeps Clerk as the
            identity layer while the existing backend continues to handle app
            authorization.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:max-w-2xl">
            {highlights.map((item) => (
              <div
                className="glass-panel rounded-2xl border border-border p-4 text-left"
                key={item}
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mb-3 size-4 text-emerald-300"
                />
                <p className="text-sm leading-5">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.section
          animate={{ opacity: 1, scale: 1, y: 0 }}
          aria-labelledby="auth-title"
          className="glass-panel mx-auto w-full max-w-md rounded-[2rem] border border-border p-5 shadow-2xl sm:p-6"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <div className="rounded-[1.5rem] border border-border bg-background/70 p-5 sm:p-6">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isSignIn ? "Sign in" : "Sign up"}
                </p>
                <h2 id="auth-title" className="mt-1 text-2xl font-semibold">
                  {isSignIn ? "Continue to HUDDLE" : "Start with HUDDLE"}
                </h2>
              </div>
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/25 bg-emerald-300/10 text-emerald-300">
                <UsersRound aria-hidden="true" className="size-5" />
              </span>
            </div>

            <Button
              className="h-12 w-full"
              disabled={!isLoaded || loading}
              onClick={() => void startGoogle()}
              type="button"
            >
              <GoogleMark />
              {loading
                ? "Opening Google..."
                : isSignIn
                  ? "Continue with Google"
                  : "Sign up with Google"}
              <ArrowRight aria-hidden="true" />
            </Button>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>Email access</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    aria-describedby="email-note"
                    className="pl-11"
                    disabled
                    id="email"
                    placeholder="Email sign-in is coming soon"
                    type="email"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    className="pl-11"
                    disabled
                    id="password"
                    placeholder="Password support is future-ready"
                    type="password"
                  />
                </div>
              </div>
              <p id="email-note" className="text-xs leading-5 text-muted-foreground">
                Google authentication is enabled for this workspace. Email and
                password fields are styled for the future Clerk strategy without
                changing the current OAuth setup.
              </p>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignIn ? "New to HUDDLE?" : "Already have an account?"}{" "}
              <Link
                className="font-medium text-foreground underline-offset-4 hover:underline"
                href={isSignIn ? "/sign-up" : "/sign-in"}
              >
                {isSignIn ? "Create an account" : "Sign in"}
              </Link>
            </p>

            <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">
              By continuing, you agree to HUDDLE&apos;s terms and privacy
              practices.
            </p>
          </div>
        </motion.section>
      </section>
    </main>
  );
}
