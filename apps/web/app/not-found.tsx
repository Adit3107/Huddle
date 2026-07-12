import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-md">
        <p className="text-sm font-medium text-emerald-300">404</p>
        <h1 className="mt-4 text-3xl font-semibold">Room not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This page may have expired, been archived, or never existed.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">Return home</Link>
        </Button>
      </div>
    </main>
  );
}
