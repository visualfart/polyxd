import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Point at the renderer's source so edits show up instantly.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@polyxd/react/styles.css": fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url)),
      "@polyxd/react": fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173, fs: { allow: ["../.."] } },
});
