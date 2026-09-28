/**
 * Which registries still need this version of the extension. The release workflow runs it before
 * packaging: a registry is skipped, with a notice, when it has no credentials (the AZURE_CLIENT_ID
 * variable or VSCE_PAT for the Visual Studio Marketplace, OVSX_PAT for Open VSX) or when it already has this version. The
 * lookups are public and need no token. A lookup that fails stops the release rather than guess.
 *
 *   node apps/vscode/scripts/published.ts
 *
 * In GitHub Actions it writes `marketplace`, `openvsx` and `any` (true or false) and `vsix` (the
 * file `npm run package` writes) to the step's outputs; anywhere else it prints them.
 */
import { appendFileSync, readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const id = `${pkg.publisher}.${pkg.name}`;
const version: string = pkg.version;

/** The versions the Visual Studio Marketplace lists for the extension; none when it has never been published. */
async function marketplaceVersions(): Promise<string[]> {
  const res = await fetch("https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json;api-version=3.0-preview.1" },
    // filterType 7 is the extension's full name; flag 0x1 includes its versions.
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: id }] }], flags: 0x1 }),
  });
  if (!res.ok) throw new Error(`Marketplace lookup: ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { results?: { extensions?: { versions?: { version: string }[] }[] }[] };
  return (body.results?.[0]?.extensions?.[0]?.versions ?? []).map((v) => v.version);
}

/** Whether Open VSX has this version: its API answers 404 for a version (or extension) it hasn't got. */
async function onOpenVsx(): Promise<boolean> {
  const res = await fetch(`https://open-vsx.org/api/${pkg.publisher}/${pkg.name}/${version}`, { headers: { accept: "application/json" } });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Open VSX lookup: ${res.status} ${res.statusText}`);
  return true;
}

const notice = (message: string) => console.log(process.env.GITHUB_ACTIONS ? `::notice title=VS Code extension::${message}` : message);

async function need(registry: string, secrets: string[], has: () => Promise<boolean>): Promise<boolean> {
  if (!secrets.some((name) => process.env[name])) {
    notice(`${registry}: skipped, none of ${secrets.join(" or ")} is set (apps/vscode/PUBLISHING.md)`);
    return false;
  }
  if (await has()) {
    notice(`${registry}: ${id} ${version} is already published`);
    return false;
  }
  console.log(`${registry}: will publish ${id} ${version}`);
  return true;
}

const marketplace = await need("Visual Studio Marketplace", ["AZURE_CLIENT_ID", "VSCE_PAT"], async () => (await marketplaceVersions()).includes(version));
const openvsx = await need("Open VSX", ["OVSX_PAT"], onOpenVsx);
const outputs = { marketplace, openvsx, any: marketplace || openvsx, vsix: `${pkg.name}-${version}.vsix` };
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(outputs).map(([k, v]) => `${k}=${v}\n`).join(""));
else console.log(outputs);
