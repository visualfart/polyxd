/**
 * Renders the directory listing's images: the icon (brand/chosen-mark.svg on paper, 512 and 1024)
 * and the carousel screenshots (screenshots/documents/*.json, each shown by the real server and
 * drawn by the real MCP App in headless Chromium, with this script playing the host, as
 * test/view.test.ts does).
 *
 *   npm run build -w @polyxd/mcp && node packages/mcp/listing/render.ts
 *
 * Every document is checked with polyxd_validate and polyxd_verify first; one with an error stops
 * the run, so nothing unchecked is ever pictured. The raw renders go to screenshots/raw/, with the
 * first document also drawn in other packs for the "any design system" image; compose.ts then
 * lays them out as the directory carousel (screenshots/) and the marketing set (marketing/).
 */
import { mkdirSync } from "node:fs";
import { compose, type RawShot } from "./compose.ts";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { validateDocument } from "@polyxd/spec";
import { createServer, viewHTML } from "../dist/index.js";

const here = (p: string) => new URL(p, import.meta.url);
const PAPER = "#F3F1EC";
/** The width the response is drawn at, in CSS pixels (a wide chat column); the PNGs are 1.6 times that. */
const WIDTH = 1000;
const SCALE = 1.6;

interface Shot {
  prompt: string;
  pack: string;
  mode: "light" | "dark";
  document: Record<string, unknown>;
}

const textOf = (r: any): string => (r.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");

// ---------- The server, in memory, as a host that shows MCP Apps would connect to it ----------

const server = createServer();
const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
const client = new Client(
  { name: "listing-host", version: "0.0.0" },
  { capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } } as any },
);
await server.connect(serverSide);
await client.connect(clientSide);
const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }) as Promise<any>;

const browser = await chromium.launch();

// ---------- Icon ----------

// The chosen artwork, byte for byte, placed as brand/build.ts places it on an app icon's tile
// (13% in, 74% of the side), on a full-bleed paper square so any crop the directory applies keeps it.
const markFile = readFileSync(here("../../../brand/chosen-mark.svg"), "utf8").trim();
const markUri = `data:image/svg+xml;base64,${Buffer.from(markFile).toString("base64")}`;
for (const size of [512, 1024]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><body style="margin:0;width:${size}px;height:${size}px;background:${PAPER};position:relative"><img src="${markUri}" alt="" style="position:absolute;left:${size * 0.13}px;top:${size * 0.13}px;width:${size * 0.74}px;height:${size * 0.74}px"></body>`,
  );
  await page.waitForFunction(() => document.images[0]?.complete);
  await page.screenshot({ path: here(`icon-${size}.png`).pathname });
  await page.close();
  console.log(`wrote listing/icon-${size}.png`);
}

// ---------- Screenshots ----------

/** A host page: the view in a sandboxed iframe, sized to what the view reports, fed one tool result. */
async function host(page: Page, toolResult: unknown, theme: "light" | "dark") {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:${theme === "dark" ? "#141413" : "#ffffff"}"></body></html>`);
  await page.evaluate(
    ({ html, toolResult, theme, width }) => {
      const w = window as any;
      w.sized = 0;
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.style.cssText = `display:block;width:${width}px;height:200px;border:0`;
      const reply = (msg: object) => iframe.contentWindow!.postMessage({ jsonrpc: "2.0", ...msg }, "*");
      window.addEventListener("message", (e) => {
        if (e.source !== iframe.contentWindow) return;
        const m = e.data;
        if (m.method === "ui/initialize") {
          reply({ id: m.id, result: { protocolVersion: "2026-01-26", hostInfo: { name: "listing-host", version: "0.0.0" }, hostCapabilities: {}, hostContext: { theme } } });
        } else if (m.method === "ui/notifications/initialized") {
          reply({ method: "ui/notifications/tool-input", params: { arguments: {} } });
          reply({ method: "ui/notifications/tool-result", params: toolResult });
        } else if (m.method === "ui/notifications/size-changed") {
          iframe.style.height = `${m.params.height}px`;
          w.sized = m.params.height;
        }
      });
      iframe.srcdoc = html;
      document.body.append(iframe);
    },
    { html: viewHTML(), toolResult, theme, width: WIDTH },
  );
  const frame = (await (await page.waitForSelector("iframe")).contentFrame())!;
  await frame.waitForSelector(".pxd-surface");
  await frame.evaluate(() => (document as any).fonts?.ready);
  // Let the size settle: charts and fonts can grow the page after the first report.
  let last = -1;
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(150);
    const now = await page.evaluate(() => (window as any).sized as number);
    if (now > 0 && now === last) break;
    last = now;
  }
  return page.$("iframe");
}

const dir = here("screenshots/documents/");
const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
const index: string[] = [];
mkdirSync(here("screenshots/raw/"), { recursive: true });
const raws: RawShot[] = [];

/** The colour behind the screen, so a composition can extend it rather than frame it in white. */
const backgroundOf = (iframe: any) =>
  iframe.contentFrame().then((f: any) =>
    f.evaluate(() => {
      for (const el of [document.querySelector(".pxd-surface"), document.body, document.documentElement]) {
        const c = el && getComputedStyle(el).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      }
      return "rgb(255, 255, 255)";
    }),
  ) as Promise<string>;

/** Shows a checked document in a pack and screenshots it into screenshots/raw/. */
async function shoot(name: string, document: unknown, pack: string, mode: "light" | "dark") {
  const shown = await call("polyxd_show", { document, pack, mode });
  if (shown.isError || !shown.structuredContent?.shown) throw new Error(`${name} was not shown:\n${textOf(shown)}`);
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: SCALE });
  const iframe = await host(page, shown, mode);
  const path = here(`screenshots/raw/${name}`).pathname;
  await iframe!.screenshot({ path });
  const background = await backgroundOf(iframe);
  const packName = String(shown.structuredContent.packName ?? pack);
  await page.close();
  return { path, background, pack, packName, mode };
}
for (const file of files) {
  const shot = JSON.parse(readFileSync(new URL(file, dir), "utf8")) as Shot;
  // The spec's own validator first, then the server's tools, as a host's model would call them.
  const spec = validateDocument(shot.document);
  if (!spec.valid) throw new Error(`${file} is not valid against @polyxd/spec:\n${JSON.stringify(spec.issues, null, 2)}`);
  const validated = await call("polyxd_validate", { document: shot.document });
  if (validated.isError || !validated.structuredContent?.valid) throw new Error(`${file} is not valid:\n${textOf(validated)}`);
  const verified = await call("polyxd_verify", { document: shot.document });
  const report = verified.structuredContent as { errors: number; warnings: number } | undefined;
  if (verified.isError || !report || report.errors > 0) throw new Error(`${file} failed the verifier:\n${textOf(verified)}`);
  const issues = (validated.structuredContent.issues ?? []) as unknown[];
  const png = file.replace(/\.json$/, ".png");
  const raw = await shoot(png, shot.document, shot.pack, shot.mode);
  raws.push({ file: png, prompt: shot.prompt, title: String((shot.document as any).surface?.title ?? ""), ...raw });
  console.log(`rendered ${png} (${shot.pack}, ${shot.mode}); verify: ${textOf(verified).split("\n")[0]}`);
  index.push(`${png}\t${shot.pack}\t${shot.mode}\ttrue\t${issues.length}\t${report.errors}\t${report.warnings}`);
}
// The first document again in other packs: the same screen, native in each.
const first = JSON.parse(readFileSync(new URL(files[0], dir), "utf8")) as Shot;
const variants: RawShot[] = [];
for (const [pack, mode] of [["carbon", "dark"], ["govuk", "light"], ["shadcn", "light"]] as const) {
  const name = `variant-${pack}-${mode}.png`;
  variants.push({ file: name, prompt: first.prompt, title: String((first.document as any).surface?.title ?? ""), ...(await shoot(name, first.document, pack, mode)) });
  console.log(`rendered ${name}`);
}

await compose(browser, raws, variants);

writeFileSync(here("screenshots/checked.tsv"), `file\tpack\tmode\tvalid\tvalidator issues\tverifier errors\tverifier warnings\n${index.join("\n")}\n`);

await browser.close();
await client.close();
await server.close();
