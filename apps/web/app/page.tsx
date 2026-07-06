import { LoginButton } from "@/components/auth-button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-zinc-950">
      <section className="w-full max-w-xl">
        <p className="text-sm font-medium text-teal-700">HUDDLE</p>
        <h1 className="mt-3 text-5xl font-semibold tracking-normal">
          Login to continue
        </h1>
        <p className="mt-4 max-w-md text-base leading-7 text-zinc-600">
          Use your Google account to access authenticated HUDDLE features.
          Guests can still join quick rooms without signing in.
        </p>
        <div className="mt-8">
          <LoginButton />
        </div>
      </section>
    </main>
  );
}
