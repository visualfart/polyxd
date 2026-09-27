import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * One Vite build, three products. Each is its own entry page and its own client-side router under
 * /demos/<name>/; the site's Worker serves that page for any path beneath it.
 */
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** In dev, a product's deep link (/demos/halden/payments) serves that product's page. */
function productPages(): Plugin {
  return {
    name: "polyxd-demo-pages",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const m = /^\/demos\/(halden|foundry|wexley|quay)\/(?!.*\.)(.*)$/.exec(req.url ?? "");
        if (m) req.url = `/demos/${m[1]}/index.html`;
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), productPages()],
  base: "/demos/",
  build: {
    rollupOptions: {
      input: {
        index: here("index.html"),
        halden: here("halden/index.html"),
        foundry: here("foundry/index.html"),
        wexley: here("wexley/index.html"),
        quay: here("quay/index.html"),
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom", "react-router-dom"],
    // The renderer's source, so a change in packages/react shows up without a rebuild.
    alias: {
      "@polyxd/react/styles.css": here("../../packages/react/src/styles.css"),
      "@polyxd/react/themes": here("../../packages/react/themes"),
      "@polyxd/react": here("../../packages/react/src/index.ts"),
    },
  },
  server: { port: 5174, fs: { allow: ["../.."] } },
});
