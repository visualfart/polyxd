/**
 * Packages the built extension as polyxd-vscode-<version>.vsix with vsce, for the VS Code
 * Marketplace, Open VSX, or `code --install-extension`.
 *
 *   node scripts/package.ts          (vsce builds first, through vscode:prepublish)
 *
 * README.md and CHANGELOG.md link to images and files by relative path, so they read right on
 * GitHub. A listing needs absolute URLs, so vsce rewrites them against this directory in the
 * repository: at the release's tag when the release workflow runs on one (the tag is immutable, so
 * a published version's images never change under it), else at main. vsce's own guess from
 * `repository` ignores its `directory`, which is why the bases are given here.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const repo = /github\.com\/([^/]+\/[^/.]+)/.exec(pkg.repository.url)?.[1];
if (!repo) throw new Error(`package.json's repository isn't on GitHub: ${pkg.repository.url}`);
const ref = process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME ? process.env.GITHUB_REF_NAME : "main";
const path = pkg.repository.directory;
const out = `${pkg.name}-${pkg.version}.vsix`;

execFileSync(
  "npx",
  [
    "vsce",
    "package",
    "--no-dependencies",
    "--out",
    out,
    "--baseContentUrl",
    `https://github.com/${repo}/blob/${ref}/${path}`,
    "--baseImagesUrl",
    `https://raw.githubusercontent.com/${repo}/${ref}/${path}`,
  ],
  { cwd: dir, stdio: "inherit" },
);
console.log(`links and images resolve at ${repo}@${ref}/${path}`);
