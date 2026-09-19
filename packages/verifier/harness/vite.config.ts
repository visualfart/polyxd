import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Builds a self-contained static page (relative asset paths so it loads from file://).
export default defineConfig({
  root: here("."),
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@polyxd/react/styles.css": here("../../react/src/styles.css"),
      "@polyxd/react": here("../../react/src/index.ts"),
    },
  },
  build: { outDir: here("../harness-dist"), emptyOutDir: true },
});
