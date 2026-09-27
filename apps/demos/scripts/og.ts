/**
 * Renders each product's social image (1200×630) and touch icon (180×180) with the verifier's
 * browser, from a little HTML in the product's own colours. Output goes to public/<name>/.
 *   node scripts/og.ts
 */
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { launch } from "@polyxd/verifier";

const products = [
  { name: "halden", title: "Halden", tag: "A current account that answers the question you asked.", sub: "A Polyxd demo · Material 3", bg: "#65558f", fg: "#ffffff", mark: "h", font: "Roboto, system-ui, sans-serif" },
  { name: "foundry", title: "Foundry", tag: "Customer success, keyboard first.", sub: "A Polyxd demo · shadcn/ui", bg: "#18181b", fg: "#fafafa", mark: "f", font: "Geist, system-ui, sans-serif" },
  { name: "wexley", title: "Wexley Borough Council", tag: "Council services as services, not screens.", sub: "A Polyxd demo · GOV.UK", bg: "#1d70b8", fg: "#ffffff", mark: "w", font: "Arial, sans-serif" },
];

const og = (p: (typeof products)[number]) => `<!doctype html><html><body style="margin:0;width:1200px;height:630px;background:${p.bg};color:${p.fg};font-family:${p.font};display:flex;flex-direction:column;justify-content:space-between;padding:72px;box-sizing:border-box">
<div style="display:flex;align-items:center;gap:24px"><span style="display:inline-flex;width:88px;height:88px;align-items:center;justify-content:center;border-radius:24px;background:${p.fg};color:${p.bg};font-size:56px;font-weight:500">${p.mark}</span><span style="font-size:44px;font-weight:500;letter-spacing:-0.01em">${p.title}</span></div>
<div><div style="font-size:64px;font-weight:400;line-height:1.1;letter-spacing:-0.02em;max-width:900px">${p.tag}</div><div style="margin-top:28px;font-size:28px;opacity:.8">${p.sub}</div></div></body></html>`;
const icon = (p: (typeof products)[number]) => `<!doctype html><html><body style="margin:0;width:180px;height:180px;background:${p.bg};color:${p.fg};font-family:${p.font};display:flex;align-items:center;justify-content:center;font-size:110px;font-weight:500">${p.mark}</body></html>`;

const browser = await launch();
try {
  for (const p of products) {
    const dir = fileURLToPath(new URL(`../public/${p.name}/`, import.meta.url));
    await mkdir(dir, { recursive: true });
    for (const [file, html, w, h] of [["og.png", og(p), 1200, 630], ["icon-180.png", icon(p), 180, 180]] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      await page.setContent(html);
      await page.screenshot({ path: `${dir}${file}` });
      await page.close();
      console.log(`wrote public/${p.name}/${file}`);
    }
  }
} finally {
  await browser.close();
}
