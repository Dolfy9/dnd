import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8001",
        configure: (proxy) => proxy.on("error", (e: any) => console.warn("proxy /api:", e.code || e.message)),
      },
      "/repo": {
        target: "http://localhost:8001",
        configure: (proxy) => proxy.on("error", (e: any) => console.warn("proxy /repo:", e.code || e.message)),
      },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          leaflet: ["leaflet"],
        },
      },
    },
  },
});
