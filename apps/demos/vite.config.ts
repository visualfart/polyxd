import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

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

/**
 * In dev, the live endpoint (server/live.ts) at /demos/api/*, as the site's Worker serves it. Off
 * unless POLYXD_DEMOS_LIVE=1 and the shell has a key (ANTHROPIC_API_KEY, or POLYXD_PROVIDER,
 * POLYXD_API_KEY and POLYXD_MODEL); POLYXD_DEMOS_FAKE=1 swaps in the canned generator instead.
 * `vite build` never runs this.
 */
function liveApi(): Plugin {
  const ENV = ["ANTHROPIC_API_KEY", "POLYXD_PROVIDER", "POLYXD_API_KEY", "POLYXD_MODEL", "POLYXD_DEMOS_FAKE"] as const;
  let handler: { module: unknown; handle: (request: Request, env: Record<string, string | undefined>) => Promise<Response> } | undefined;
  return {
    name: "polyxd-demo-live-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/demos/api/")) return next();
        try {
          const module = await server.ssrLoadModule("/server/live.ts");
          if (handler?.module !== module) handler = { module, handle: module.createLiveApi() };
          const controller = new AbortController();
          res.on("close", () => controller.abort());
          const body = req.method === "GET" || req.method === "HEAD" ? undefined : (Readable.toWeb(req) as ReadableStream<Uint8Array>);
          const headers = new Headers(Object.entries(req.headers).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(", ") : v] as [string, string]])));
          const request = new Request(new URL(req.url, `http://${req.headers.host ?? "localhost"}`), { method: req.method, headers, body, signal: controller.signal, duplex: "half" } as RequestInit);
          // A key in the shell only counts with POLYXD_DEMOS_LIVE=1, so a key exported for other work is never spent here.
          const env = Object.fromEntries(ENV.filter((k) => k === "POLYXD_DEMOS_FAKE" || process.env.POLYXD_DEMOS_LIVE === "1").map((k) => [k, process.env[k]]));
          const response = await handler.handle(request, env);
          res.writeHead(response.status, Object.fromEntries(response.headers));
          if (!response.body) return void res.end();
          for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
          res.end();
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), liveApi(), productPages()],
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
