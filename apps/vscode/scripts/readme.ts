/**
 * The README's Commands and Settings tables, written from package.json's `contributes` so the
 * listing never disagrees with what the extension registers. Each command needs a line in WHAT
 * below; a command without one fails here, and so does test/readme.test.ts.
 *
 *   node scripts/readme.ts            rewrite the tables in README.md
 *   node scripts/readme.ts --check    fail if they're out of date
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** What each command does, in a sentence. */
export const WHAT: Record<string, string> = {
  "polyxd.openPreview": "Opens the live preview beside the editor. Also the icon in a document's title bar.",
  "polyxd.verify": "Runs `polyxd-verify` on the document in a terminal: all 13 packs, light and dark, 390 and 1100 wide.",
  "polyxd.insertComponent": "Picks one of the 44 components by category and inserts a valid skeleton at the cursor.",
  "polyxd.openInStudio": "Copies the document to the clipboard and opens Polyxd Studio, where Paste JSON makes a screen of it.",
  "polyxd.pushToStudio": "Runs `polyxd studio push` for the document, with your Studio API key.",
  "polyxd.setStudioKey": "Stores your Studio API key in the editor's secret storage. Leave it empty to remove it.",
  "polyxd.refreshDocuments": "Rescans the workspace for the Polyxd documents view (its title-bar button).",
};

const WHEN: Record<string, string> = { "polyxd.isDocument": "In a Polyxd document", false: "Documents view only" };

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function tables(pkg: any): { commands: string; settings: string } {
  const palette = new Map<string, string>((pkg.contributes.menus?.commandPalette ?? []).map((m: { command: string; when?: string }) => [m.command, m.when ?? ""]));
  const missing = pkg.contributes.commands.filter((c: { command: string }) => !WHAT[c.command]).map((c: { command: string }) => c.command);
  if (missing.length) throw new Error(`scripts/readme.ts has no description for ${missing.join(", ")}`);
  const commands = [
    "| Command | What it does | Available |",
    "|---|---|---|",
    ...pkg.contributes.commands.map((c: { command: string; title: string; category?: string }) => {
      const when = palette.get(c.command);
      return `| **${c.category ? `${c.category}: ` : ""}${c.title}** | ${esc(WHAT[c.command])} | ${when ? (WHEN[when] ?? `\`${when}\``) : "Always"} |`;
    }),
  ].join("\n");
  const settings = [
    "| Setting | Default | What it does |",
    "|---|---|---|",
    ...Object.entries(pkg.contributes.configuration.properties).map(([key, p]: [string, any]) => {
      const text = p.markdownDescription ?? p.description ?? "";
      const choices = p.enum ? ` One of ${p.enum.map((v: string) => `\`${v}\``).join(", ")}.` : "";
      return `| \`${key}\` | ${p.default === "" ? "(empty)" : `\`${JSON.stringify(p.default).replace(/^"|"$/g, "")}\``} | ${esc(text)}${choices} |`;
    }),
  ].join("\n");
  return { commands, settings };
}

/** README text with the generated sections replaced. */
export function withTables(readme: string, pkg: any): string {
  const t = tables(pkg);
  let out = readme;
  for (const [name, body] of Object.entries(t)) {
    const re = new RegExp(`(<!-- generated:${name} [^>]*-->\\n)[\\s\\S]*?(\\n<!-- /generated:${name} -->)`);
    if (!re.test(out)) throw new Error(`README.md has no <!-- generated:${name} … --> section`);
    out = out.replace(re, (_m, open, close) => `${open}${body}${close}`);
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const readmePath = fileURLToPath(new URL("../README.md", import.meta.url));
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const readme = readFileSync(readmePath, "utf8");
  const next = withTables(readme, pkg);
  if (process.argv.includes("--check")) {
    if (next !== readme) {
      console.error("README.md's Commands or Settings table is out of date: node scripts/readme.ts");
      process.exit(1);
    }
    console.log("README tables match package.json");
  } else {
    writeFileSync(readmePath, next);
    console.log(next === readme ? "README tables already current" : "rewrote README tables");
  }
}
