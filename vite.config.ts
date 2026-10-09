import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "/travelapp/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Travel Planner",
        short_name: "Travel Planner",
        description: "Your journeys, thoughtfully organised.",
        theme_color: "#F7F2EC",
        background_color: "#F7F2EC",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
});
