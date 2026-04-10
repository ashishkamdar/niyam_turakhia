import type { MetadataRoute } from "next";

/**
 * PWA manifest for PrismX. When a user saves nt.areakpi.in to their phone's
 * home screen (iOS: Share → Add to Home Screen; Android: Install from the
 * browser menu), the device reads this manifest and uses the icons below
 * as the home-screen icon + splash screen.
 *
 * Background/theme colors match the dark-mode UI (gray-950) and the amber
 * accent color used throughout the app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PrismX — Precious Metals MIS",
    short_name: "PrismX",
    description: "Real-time profitability dashboard for precious metals trading",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#030712",
    theme_color: "#030712",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
