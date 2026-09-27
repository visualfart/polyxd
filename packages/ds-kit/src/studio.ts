/**
 * `polyxd studio push`: send a design system's tokens to Polyxd Studio from wherever the tokens
 * live: a package directory (packed with npm, so private dependencies and registries never
 * matter), a tarball, or one token file (DTCG or Tokens Studio JSON, or CSS custom properties).
 *
 *   POLYXD_STUDIO_KEY=… npx polyxd studio push ./ --to https://studio.polyxd.com/api/w/acme
 *   npx polyxd studio push ./tokens.css --to … --name "Acme tokens"
 *   npx polyxd studio push ./dist/tokens-2.4.0.tgz --to … --into <designSystemId>
 *
 * Studio scans the tokens (tiers, modes, aliases, issues) and answers with a link to review the
 * mapping. A push with the same package name lands as a new version of the same design system,
 * so a CI step can run it on every release.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface PushOptions {
  /** Directory, tarball or token file. */
  path: string;
  /** The workspace's API base, e.g. https://studio.polyxd.com/api/w/acme */
  to: string;
  key: string;
  /** Add a version to this design system instead of matching by package name. */
  into?: string;
  /** Name for a new design system (defaults to the package name or the file name). */
  name?: string;
  /** Override fetch, for tests. */
  fetch?: typeof fetch;
}

export interface PushResult {
  designSystemId: string;
  versionId: string;
  number: number;
  /** Where to review the mapping in Studio. */
  url: string;
  scan: { format: string; total: number; byTier: Record<string, number>; modes: { name: string }[]; issues: { kind: string; count: number }[]; picked?: string[] };
}

/** What gets uploaded: the bytes, the file name, and the package identity when there is one. */
export async function prepare(path: string): Promise<{ bytes: Uint8Array; fileName: string; packageName?: string; packageVersion?: string; cleanup: () => Promise<void> }> {
  const target = resolve(path);
  const info = await stat(target).catch(() => null);
  if (!info) throw new Error(`${path} does not exist`);
  if (info.isDirectory()) {
    const pkgFile = join(target, "package.json");
    const pkg = JSON.parse(await readFile(pkgFile, "utf8").catch(() => {
      throw new Error(`${path} has no package.json; point at a token file instead`);
    })) as { name?: string; version?: string };
    // npm pack honours "files", .npmignore and prepack, so the tarball is what a release would be.
    const dir = await mkdtemp(join(tmpdir(), "polyxd-push-"));
    const { stdout } = await exec("npm", ["pack", "--json", "--pack-destination", dir, "--ignore-scripts"], { cwd: target, maxBuffer: 16 * 1024 * 1024 });
    const [packed] = JSON.parse(stdout) as { filename: string; name: string; version: string }[];
    const bytes = new Uint8Array(await readFile(join(dir, packed.filename)));
    return { bytes, fileName: packed.filename, packageName: packed.name ?? pkg.name, packageVersion: packed.version ?? pkg.version, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }
  const bytes = new Uint8Array(await readFile(target));
  return { bytes, fileName: basename(target), cleanup: async () => undefined };
}

export async function push(opts: PushOptions): Promise<PushResult> {
  const to = opts.to.replace(/\/+$/, "");
  if (!/^https?:\/\/.+\/api\/w\/[a-z0-9-]+$/i.test(to)) throw new Error(`--to should look like https://studio.example.com/api/w/<workspace>, not ${opts.to}`);
  if (!opts.key) throw new Error("No key: set POLYXD_STUDIO_KEY or pass --key (Team → API keys in Studio)");
  const prepared = await prepare(opts.path);
  try {
    const form = new FormData();
    form.set("file", new Blob([prepared.bytes.slice().buffer as ArrayBuffer]), prepared.fileName);
    if (opts.name) form.set("name", opts.name);
    if (opts.into) form.set("designSystemId", opts.into);
    if (prepared.packageName) form.set("packageName", prepared.packageName);
    if (prepared.packageVersion) form.set("packageVersion", prepared.packageVersion);
    const res = await (opts.fetch ?? fetch)(`${to}/design-systems/import`, { method: "POST", headers: { authorization: `Bearer ${opts.key}` }, body: form });
    const text = await res.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      /* an HTML error page from a proxy: the status line says enough */
    }
    if (!res.ok) throw new Error(data.error ?? `Studio answered ${res.status} ${res.statusText}`);
    const app = new URL(to);
    const slug = to.split("/").pop();
    return { ...data, url: data.url ?? `${app.origin}/w/${slug}/design-systems/${data.designSystemId}/versions/${data.versionId}/scan` };
  } finally {
    await prepared.cleanup();
  }
}

/** One line per fact, the way the pack command reports. */
export function describe(r: PushResult, fileName: string): string {
  const tiers = Object.entries(r.scan.byTier ?? {})
    .filter(([, n]) => n)
    .map(([t, n]) => `${n} ${t}`)
    .join(", ");
  const modes = (r.scan.modes ?? []).map((m) => m.name).join(", ");
  const issues = (r.scan.issues ?? []).reduce((s, i) => s + i.count, 0);
  return [
    `Pushed ${fileName} as version ${r.number}.`,
    `${r.scan.total} tokens (${r.scan.format}${tiers ? `; ${tiers}` : ""})${modes ? ` · modes: ${modes}` : ""}${issues ? ` · ${issues} thing${issues === 1 ? "" : "s"} to look at` : ""}`,
    `Review the mapping: ${r.url}`,
  ].join("\n");
}

export async function main(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  if (sub !== "push") {
    console.log(`polyxd studio push <package dir | tarball | token file> --to <studio>/api/w/<workspace> [--into <designSystemId>] [--name <name>] [--key <key>]

  Sends your tokens to Polyxd Studio. A directory is packed with npm (so it's what a release would
  be); the key comes from POLYXD_STUDIO_KEY or --key (Team → API keys). The same package name lands
  as a new version of the same design system each time.`);
    return sub ? 1 : 0;
  }
  const flag = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    return i > -1 ? rest[i + 1] : undefined;
  };
  const path = rest.find((a, i) => !a.startsWith("--") && (i === 0 || !rest[i - 1].startsWith("--")));
  if (!path || !flag("to")) {
    console.log("usage: polyxd studio push <path> --to <studio>/api/w/<workspace> [--into <id>] [--name <name>] [--key <key>]");
    return 2;
  }
  try {
    const r = await push({ path, to: flag("to")!, key: flag("key") ?? process.env.POLYXD_STUDIO_KEY ?? "", into: flag("into"), name: flag("name") });
    console.log(describe(r, basename(path)));
    return 0;
  } catch (e) {
    console.error((e as Error).message);
    return 1;
  }
}
