import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/rooms":  { target: process.env.VITE_BACKEND_URL || "http://localhost:8000", changeOrigin: true },
      "/upload": { target: process.env.VITE_BACKEND_URL || "http://localhost:8000", changeOrigin: true },
      "/stream": { target: process.env.VITE_BACKEND_URL || "http://localhost:8000", changeOrigin: true },
      "/ws":     { target: process.env.VITE_BACKEND_URL || "http://localhost:8000", changeOrigin: true, ws: true },
    },
  },
});
