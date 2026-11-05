import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/test-results/**", "**/release/**", "**/docs/**"] },
  },
  worker: { format: "es" },
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
});
