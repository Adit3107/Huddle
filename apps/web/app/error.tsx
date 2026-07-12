"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary">
          <AlertCircle aria-hidden="true" className="size-6 text-destructive" />
        </div>
        <h1 className="mt-6 text-3xl font-semibold">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          HUDDLE could not load this view. Try again, or return to the previous
          page if the issue continues.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Error digest: {error.digest}
          </p>
        ) : null}
        <Button className="mt-6" onClick={reset} type="button">
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      </div>
    </main>
  );
}
