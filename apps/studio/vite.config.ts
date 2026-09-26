import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  // `vite dev` for the front end alone; the API comes from `wrangler dev` on 8787.
  server: { proxy: { "/api": "http://localhost:8787" } },
});
