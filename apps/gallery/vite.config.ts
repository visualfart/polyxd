import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";

const rankingFiles = {
  gold: fileURLToPath(new URL("../../bench/gold/ranking.json", import.meta.url)),
  model: fileURLToPath(new URL("../../bench/rank-set/ranking.json", import.meta.url)),
};
/** Which set the page is ranking: the hand-made gold set, or the model's own options. */
const fileFor = (url = "") => (new URLSearchParams(url.split("?")[1] ?? "").get("set") === "model" ? rankingFiles.model : rankingFiles.gold);

/** Dev-only endpoint the ranking page saves to. */
function goldRanking(): Plugin {
  return {
    name: "polyxd-gold-ranking",
    configureServer(server) {
      server.middlewares.use("/api/gold-ranking", (req, res) => {
        if (req.method === "GET") {
          res.setHeader("content-type", "application/json");
          return res.end(readFileSync(fileFor(req.url), "utf8"));
        }
        if (req.method !== "POST") return (res.statusCode = 405), res.end();
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { rater, ranks, notes = {}, comments = {}, annotations = {} } = JSON.parse(body) as {
              rater: string;
              ranks: Record<string, string[]>;
              notes?: Record<string, Record<string, string>>;
              comments?: Record<string, string>;
              annotations?: Record<string, Record<string, { id: string; component: string; part?: string; note: string }[]>>;
            };
            const rankingFile = fileFor(req.url);
            const file = JSON.parse(readFileSync(rankingFile, "utf8"));
            file.rater = rater || null;
            for (const g of file.groups) {
              const r = ranks[g.id];
              // Only accept a full ordering of this group's own variants.
              g.humanRank = r && r.length === g.variants.length && r.every((v) => g.variants.includes(v)) ? r : g.humanRank ?? null;
              // Free-text notes per variant and for the group as a whole (only for this group's variants).
              const n = Object.fromEntries(Object.entries(notes[g.id] ?? {}).filter(([v, t]) => g.variants.includes(v) && typeof t === "string" && t.trim()));
              if (Object.keys(n).length) g.notes = n;
              else delete g.notes;
              if (typeof comments[g.id] === "string" && comments[g.id].trim()) g.comment = comments[g.id].trim();
              else delete g.comment;
              // Element-level annotations: which component (by id in that variant's document) and the note.
              const a = Object.fromEntries(
                Object.entries(annotations[g.id] ?? {})
                  .filter(([v]) => g.variants.includes(v))
                  .map(([v, list]) => [v, (list ?? []).filter((x) => x && typeof x.id === "string").map(({ id, component, part, note }) => ({ id, component, ...(part ? { part } : {}), note: String(note ?? "") }))])
                  .filter(([, list]) => (list as unknown[]).length),
              );
              if (Object.keys(a).length) g.annotations = a;
              else delete g.annotations;
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
