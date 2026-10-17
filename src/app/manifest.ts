import type { MetadataRoute } from "next";

// Installable web app. Store builds (Capacitor) reuse this name and colors.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sacred Pair",
    short_name: "Sacred Pair",
    start_url: "/discover",
    display: "standalone",
    background_color: "#fafafc",
    theme_color: "#4a3d8f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
