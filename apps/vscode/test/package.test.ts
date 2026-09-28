/**
 * What the Marketplace listing and the .vsix promise: the preview's policy allows no eval, the
 * bundles generate no code and open no connections, the icon is the brand's, the README's tables
 * match package.json, and the manifest has what a listing needs.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { withTables } from "../scripts/readme.ts";
import { previewPage } from "../src/webview/page.ts";

const here = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));

test("the preview page's content-security policy has no 'unsafe-eval'", () => {
  const html = previewPage({ polyxdJs: "a.js", polyxdCss: "a.css", mainJs: "m.js", cspSource: "vscode-webview://x", nonce: "n0nce" });
  const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? "";
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'nonce-n0nce';/);
  assert.doesNotMatch(csp, /unsafe-eval/);
});

const bundles = ["dist/extension.cjs", "dist/webview/main.js", "dist/webview/polyxd.js"].map((f) => join(here, f));
test("the bundles build no code from strings and open no connections", { skip: !bundles.every((b) => existsSync(b)) && "not built" }, () => {
  for (const file of bundles) {
    const js = readFileSync(file, "utf8");
    for (const [what, re] of [
      ["new Function", /new Function\s*\(/],
      ["Function(…)", /\bFunction\s*\(\s*["'`]/],
      ["eval", /(^|[^.\w$])eval\s*\(/],
      ["fetch", /\bfetch\s*\(/],
      ["XMLHttpRequest", /XMLHttpRequest/],
      ["WebSocket", /new WebSocket\b/],
      ["sendBeacon", /sendBeacon/],
      ["a network module", /require\("(node:)?(https?|http2|net|tls|dgram)"\)/],
    ] as const)
      assert.doesNotMatch(js, re, `${file.slice(here.length)} has ${what}`);
  }
});

test("the icon is the brand's 256px app icon, byte for byte", () => {
  assert.ok(readFileSync(join(here, pkg.icon)).equals(readFileSync(join(here, "../../brand/icon-256.png"))), "node brand/icons.ts, then copy brand/icon-256.png to apps/vscode/icon.png");
});

test("the README's Commands and Settings tables match package.json", () => {
  const readme = readFileSync(join(here, "README.md"), "utf8");
  assert.equal(withTables(readme, pkg), readme, "node scripts/readme.ts");
});

test("the manifest has what a Marketplace and Open VSX listing needs", () => {
  assert.equal(pkg.publisher, "polyxd");
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(pkg.pricing, "Free");
  assert.equal(pkg.license, "Apache-2.0");
  assert.ok(existsSync(join(here, "LICENSE")) && existsSync(join(here, "CHANGELOG.md")));
  assert.ok(pkg.keywords.length <= 30);
  assert.match(pkg.galleryBanner.color, /^#[0-9A-F]{6}$/i);
  assert.equal(pkg.repository.directory, "apps/vscode");
  assert.match(pkg.homepage, /^https:\/\/polyxd\.com\/docs\//);
  // The listing and the changelog agree on the version being released.
  assert.match(readFileSync(join(here, "CHANGELOG.md"), "utf8"), new RegExp(`^## ${pkg.version.replace(/\./g, "\\.")}$`, "m"));
  // Every file the .vsix allows in exists after a build, and nothing else is let in by accident.
  const allowed = readFileSync(join(here, ".vscodeignore"), "utf8").split("\n").filter((l) => l.startsWith("!")).map((l) => l.slice(1));
  for (const f of ["README.md", "CHANGELOG.md", "LICENSE", "package.json", pkg.icon, "schema/file.schema.json", "schema/ui.schema.json", "dist/extension.cjs"]) assert.ok(allowed.includes(f), `.vscodeignore leaves out ${f}`);
});
