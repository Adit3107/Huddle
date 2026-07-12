import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HUDDLE",
    short_name: "HUDDLE",
    description:
      "Quick rooms, private groups, anonymous collaboration, and realtime chat.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07080b",
    theme_color: "#71e8bd",
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "maskable"
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ]
  };
}
