import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/rooms": process.env.VITE_BACKEND_URL || "http://localhost:8000",
      "/upload": process.env.VITE_BACKEND_URL || "http://localhost:8000",
      "/stream": process.env.VITE_BACKEND_URL || "http://localhost:8000",
    },
  },
});
