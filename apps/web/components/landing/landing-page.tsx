"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Fingerprint,
  Layers3,
  MessageSquareDashed,
  QrCode,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Zap
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { LoginButton, LogoutButton } from "@/components/auth-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Zap,
    title: "Quick Rooms",
    description:
      "Start a temporary collaboration space for the conversation that needs to happen now."
  },
  {
    icon: UsersRound,
    title: "Groups",
    description:
      "Keep recurring teams organized with owned rooms, private access, and clear room context."
  },
  {
    icon: Fingerprint,
    title: "Anonymous Collaboration",
    description:
      "Let guests join safely with display names while authenticated members keep continuity."
  },
  {
    icon: QrCode,
    title: "QR Sharing",
    description:
      "Turn a room into a scannable handoff for workshops, classrooms, and fast standups."
  },
  {
    icon: Clock,
    title: "Temporary Rooms",
    description:
      "Set expiry windows so lightweight rooms disappear from the workspace when the moment ends."
  },
  {
    icon: ShieldCheck,
    title: "Owner Controls",
    description:
      "Edit details, archive rooms, and inspect participation without changing backend rules."
  }
];

const steps = [
  "Create a quick room or group from the dashboard.",
  "Share the link or QR code with the people who need context.",
  "Collaborate with clear ownership, expiry, and room-level analytics."
];

const testimonials = [
  {
    quote:
      "HUDDLE feels like the meeting room equivalent of a command palette: quick, precise, and calm.",
    name: "Anika Rao",
    role: "Product Lead"
  },
  {
    quote:
      "The temporary rooms are perfect for reviews where we need focus without creating another permanent channel.",
    name: "Mateo Ellis",
    role: "Design Systems"
  },
  {
    quote:
      "QR sharing made our live sessions feel effortless. People entered the right room without a tutorial.",
    name: "Priya Shah",
    role: "Engineering Manager"
  }
];

function fadeUp(delay = 0) {
  return {
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.55, delay, ease: "easeOut" as const }
  };
}

function LandingNav() {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="grid size-9 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
            <MessageSquareDashed aria-hidden="true" className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-[0.18em]">HUDDLE</span>
        </Link>
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a className="transition hover:text-foreground" href="#features">
            Features
          </a>
          <a className="transition hover:text-foreground" href="#how-it-works">
            How it works
          </a>
          <a className="transition hover:text-foreground" href="#testimonials">
            Teams
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {authenticated ? (
            <>
              <Button asChild className="hidden sm:inline-flex" variant="secondary">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <LogoutButton className="hidden sm:inline-flex" />
            </>
          ) : (
            <LoginButton className="hidden sm:inline-flex" />
          )}
        </div>
      </nav>
    </header>
  );
}

export function LandingPage() {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  return (
    <main className="aurora-shell min-h-screen text-foreground">
      <LandingNav />
      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-7xl content-center px-5 py-20 sm:px-8 lg:py-28">
        <motion.div
          animate={{ opacity: 0.9, scale: [1, 1.04, 1] }}
          className="absolute right-8 top-24 hidden size-64 rounded-full border border-emerald-300/20 bg-emerald-300/10 blur-sm lg:block"
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          animate={{ y: [0, -18, 0], rotate: [0, 2, 0] }}
          className="absolute bottom-16 left-8 hidden h-44 w-72 rounded-[2rem] border border-violet-300/15 bg-violet-300/10 blur-[1px] lg:block"
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative grid gap-12 lg:grid-cols-[1.04fr_0.96fr] lg:items-center">
          <div>
            <motion.div {...fadeUp()}>
              <Badge className="mb-6" variant="accent">
                <Sparkles aria-hidden="true" className="size-3" />
                Rooms before chat, polished for real work
              </Badge>
            </motion.div>
            <motion.h1
              {...fadeUp(0.08)}
              className="max-w-4xl text-5xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl"
            >
              Spin up focused rooms for every collaboration moment.
            </motion.h1>
            <motion.p
              {...fadeUp(0.16)}
              className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground"
            >
              HUDDLE gives teams quick rooms, persistent groups, anonymous guest
              collaboration, QR sharing, and temporary spaces without adding
              clutter to the workspace.
            </motion.p>
            <motion.div
              {...fadeUp(0.24)}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              {authenticated ? (
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Open dashboard <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <LoginButton size="lg" />
              )}
              <Button asChild size="lg" variant="outline">
                <a href="#features">Explore features</a>
              </Button>
            </motion.div>
          </div>
          <motion.div
            animate={{ y: [0, -10, 0] }}
            className="glass-panel relative overflow-hidden rounded-[2rem] border border-border p-4"
            initial={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="rounded-[1.5rem] border border-border bg-background/65 p-5">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Workspace</p>
                  <h2 className="mt-1 text-2xl font-semibold">Design Crit</h2>
                </div>
                <Badge variant="accent">Live ready</Badge>
              </div>
              <div className="grid gap-3">
                {[
                  ["Quick Room", "15 min review", "3 participants"],
                  ["Product Group", "Private team space", "12 participants"],
                  ["Anonymous Retro", "Expires tonight", "QR enabled"]
                ].map(([title, detail, meta], index) => (
                  <motion.div
                    animate={{ opacity: [0.84, 1, 0.84] }}
                    className="rounded-2xl border border-border bg-card p-4"
                    key={title}
                    transition={{
                      duration: 3.4,
                      delay: index * 0.35,
                      repeat: Infinity
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {detail}
                        </p>
                      </div>
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                        {meta}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <motion.div {...fadeUp()} className="max-w-2xl">
          <p className="text-sm font-medium text-emerald-300">Design system</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-normal">
            Minimal controls, rich context, no noise.
          </h2>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.article
              {...fadeUp(index * 0.04)}
              className="glass-panel rounded-2xl border border-border p-6 transition hover:-translate-y-1 hover:border-emerald-300/30"
              key={feature.title}
            >
              <feature.icon aria-hidden="true" className="size-5 text-emerald-300" />
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {feature.description}
              </p>
            </motion.article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative border-y border-border/70">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <motion.div {...fadeUp()} className="max-w-2xl">
            <p className="text-sm font-medium text-emerald-300">Flow</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-normal">
              From idea to room in three calm steps.
            </h2>
          </motion.div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <motion.div
                {...fadeUp(index * 0.08)}
                className="rounded-2xl border border-border bg-card p-6"
                key={step}
              >
                <div className="grid size-10 place-items-center rounded-2xl bg-secondary text-sm font-semibold">
                  {index + 1}
                </div>
                <p className="mt-8 text-lg leading-7">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section id="testimonials" className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.figure
              {...fadeUp(index * 0.08)}
              className="rounded-2xl border border-border bg-card p-6"
              key={testimonial.name}
            >
              <blockquote className="text-base leading-7">
                “{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-8">
                <p className="font-medium">{testimonial.name}</p>
                <p className="text-sm text-muted-foreground">{testimonial.role}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        <motion.div
          {...fadeUp()}
          className="glass-panel overflow-hidden rounded-[2rem] border border-border p-8 sm:p-12"
        >
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <Layers3 aria-hidden="true" className="mb-5 size-6 text-emerald-300" />
              <h2 className="text-4xl font-semibold tracking-normal">
                Build the room first. Bring chat later.
              </h2>
              <p className="mt-4 text-muted-foreground">
                HUDDLE is now ready for polished room creation, sharing, and
                management before the messaging layer begins.
              </p>
            </div>
            {authenticated ? (
              <Button asChild size="lg">
                <Link href="/dashboard">Open dashboard</Link>
              </Button>
            ) : (
              <LoginButton size="lg" />
            )}
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>HUDDLE</p>
          <p>Quick rooms, groups, QR sharing, and temporary collaboration.</p>
        </div>
      </footer>
    </main>
  );
}
