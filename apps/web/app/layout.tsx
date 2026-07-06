import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { HuddleSessionProvider } from "@/providers/session-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "HUDDLE",
  description: "Collaborative communication platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <HuddleSessionProvider>{children}</HuddleSessionProvider>
      </body>
    </html>
  );
}
