import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rulers",
    short_name: "Rulers",
    description:
      "Track your game of Rulers: conquest, politics, and civilization-building",
    start_url: "/",
    display: "standalone",
    background_color: "#140d09",
    theme_color: "#140d09",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
