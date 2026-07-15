import type { Metadata } from "next";
import type { Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/providers/theme-provider";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: "HUDDLE",
  title: {
    default: "HUDDLE | Rooms for focused collaboration",
    template: "%s | HUDDLE"
  },
  description:
    "Create quick rooms, private groups, anonymous collaboration spaces, and temporary shareable huddles.",
  keywords: [
    "team collaboration",
    "quick rooms",
    "realtime chat",
    "temporary rooms",
    "group chat"
  ],
  authors: [{ name: "HUDDLE" }],
  creator: "HUDDLE",
  publisher: "HUDDLE",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }
    ],
    apple: [{ url: "/apple-touch-icon.svg", type: "image/svg+xml" }]
  },
  openGraph: {
    title: "HUDDLE | Rooms for focused collaboration",
    description:
      "Create quick rooms, private groups, anonymous collaboration spaces, and temporary shareable huddles.",
    url: appUrl,
    siteName: "HUDDLE",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "HUDDLE | Rooms for focused collaboration",
    description:
      "Create quick rooms, private groups, anonymous collaboration spaces, and temporary shareable huddles."
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f8" },
    { media: "(prefers-color-scheme: dark)", color: "#07080b" }
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <ClerkProvider
          afterSignOutUrl="/"
          signInFallbackRedirectUrl="/dashboard"
          signInForceRedirectUrl="/dashboard"
          signInUrl="/sign-in"
          signUpFallbackRedirectUrl="/dashboard"
          signUpForceRedirectUrl="/dashboard"
          signUpUrl="/sign-up"
        >
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
