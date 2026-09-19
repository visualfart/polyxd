import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const rankingFile = fileURLToPath(new URL("../../bench/gold/ranking.json", import.meta.url));

/** Dev-only endpoint the gold-set ranking page saves to (writes bench/gold/ranking.json). */
function goldRanking(): Plugin {
  return {
    name: "polyxd-gold-ranking",
    configureServer(server) {
      server.middlewares.use("/api/gold-ranking", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("content-type", "application/json");
          return res.end(readFileSync(rankingFile, "utf8"));
        }
        if (req.method !== "POST") return (res.statusCode = 405), res.end();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { rater, ranks } = JSON.parse(body) as { rater: string; ranks: Record<string, string[]> };
            const file = JSON.parse(readFileSync(rankingFile, "utf8"));
            file.rater = rater || null;
            for (const g of file.groups) {
              const r = ranks[g.id];
              // Only accept a full ordering of this group's own variants.
              g.humanRank = r && r.length === g.variants.length && r.every((v) => g.variants.includes(v)) ? r : g.humanRank ?? null;
            }
            writeFileSync(rankingFile, JSON.stringify(file, null, 2) + "\n");
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok: true, ranked: file.groups.filter((g: any) => g.humanRank).length }));
          } catch (e) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Point at the renderer's source so edits show up instantly.
export default defineConfig({
  plugins: [react(), goldRanking()],
  resolve: {
    alias: {
      "@polyxd/react/styles.css": fileURLToPath(new URL("../../packages/react/src/styles.css", import.meta.url)),
      "@polyxd/react": fileURLToPath(new URL("../../packages/react/src/index.ts", import.meta.url)),
    },
  },
  server: { port: 5173, fs: { allow: ["../.."] } },
});
