import { LogoutButton } from "@/components/auth-button";
import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <section className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Authenticated</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Welcome, {session?.user.name}
          </h1>
        </div>
        <LogoutButton />
      </section>
    </main>
  );
}
