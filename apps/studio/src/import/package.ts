/**
 * A design system as an npm package: the most common way a team already ships its tokens.
 *
 * Studio fetches the package from a registry (npm, GitHub Packages, Artifactory, anything that
 * speaks the npm protocol), unpacks the tarball in memory, and finds the token files inside. A
 * private package works three ways: a read-only registry token kept encrypted for the workspace,
 * a tarball from `npm pack` uploaded by hand so no credential leaves the company, or the
 * `polyxd studio push` command run inside the company's network with a workspace API key.
 */

export interface Entry {
  path: string;
  bytes: Uint8Array;
}

/** A gzipped tar, unpacked. Tar is 512-byte headers followed by the file's blocks. */
export async function untar(tgz: ArrayBuffer): Promise<Entry[]> {
  const stream = new Blob([tgz]).stream().pipeThrough(new DecompressionStream("gzip"));
  const tar = new Uint8Array(await new Response(stream).arrayBuffer());
  const entries: Entry[] = [];
  const text = new TextDecoder();
  const field = (at: number, len: number) => text.decode(tar.subarray(at, at + len)).replace(/\0.*$/s, "");
  let longName: string | null = null;
  for (let off = 0; off + 512 <= tar.length; ) {
    if (tar[off] === 0) break;
    let name = field(off, 100);
    const size = parseInt(field(off + 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(tar[off + 156]);
    const prefix = field(off + 345, 155);
    if (prefix) name = `${prefix}/${name}`;
    const start = off + 512;
    const bytes = tar.subarray(start, start + size);
    if (type === "L") {
      // GNU long name: the next entry's real name is this entry's body.
      longName = text.decode(bytes).replace(/\0+$/, "");
    } else {
      if (longName) {
        name = longName;
        longName = null;
      }
      if (type === "0" || type === "\0" || type === "") entries.push({ path: name.replace(/^\.?\/?package\//, ""), bytes });
    }
    off = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}

export interface TokenFile {
  path: string;
  text: string;
  kind: "json" | "css";
  /** Why this file was picked over others: the number is a rank, higher first */
  score: number;
}

/** The files in a package that hold design tokens, best guess first. */
export function findTokenFiles(entries: Entry[]): TokenFile[] {
  const text = new TextDecoder();
  const out: TokenFile[] = [];
  for (const e of entries) {
    if (e.bytes.length > 8_000_000 || /node_modules\//.test(e.path)) continue;
    const p = e.path.toLowerCase();
    if (/(^|\/)package\.json$/.test(p) || /\.map$/.test(p) || /\.min\.js$/.test(p)) continue;
    if (/\.json$/.test(p)) {
      const t = text.decode(e.bytes);
      if (!/"\$?value"\s*:/.test(t)) continue;
      let score = 1;
      if (/tokens?\./.test(p) || /(^|\/)tokens?(\/|\.)/.test(p)) score += 3;
      if (/\$themes|\$metadata/.test(t)) score += 2; // Tokens Studio
      if (/"\$type"|"\$value"/.test(t)) score += 1; // DTCG
      if (/(^|\/)(dist|build|src)\//.test(p)) score += 0.5;
      out.push({ path: e.path, text: t, kind: "json", score });
    } else if (/\.css$/.test(p)) {
      const t = text.decode(e.bytes);
      const vars = (t.match(/--[a-z0-9-]+\s*:/gi) ?? []).length;
      if (vars < 10) continue;
      let score = 0.5 + Math.min(3, vars / 100);
      if (/tokens?|variables?|theme|vars/.test(p)) score += 2;
      out.push({ path: e.path, text: t, kind: "css", score });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface Registry {
  url: string;
  token?: string;
}

const NPM: Registry = { url: "https://registry.npmjs.org" };

/** `@acme/tokens@1.4.0` → its metadata and tarball, from the registry that holds it. */
export async function fetchPackage(spec: string, registry: Registry = NPM): Promise<{ name: string; version: string; tgz: ArrayBuffer }> {
  const m = spec.trim().match(/^((?:@[^/@]+\/)?[^/@]+)(?:@(.+))?$/);
  if (!m) throw new Error(`"${spec}" isn't a package name`);
  const [, name, wanted] = m;
  const headers: Record<string, string> = { accept: "application/json" };
  if (registry.token) headers.authorization = `Bearer ${registry.token}`;
  const base = registry.url.replace(/\/$/, "");
  const meta = await fetch(`${base}/${name.replace("/", "%2f")}`, { headers });
  if (meta.status === 404) throw new Error(`${name} isn't on ${base}. Private? Add a registry token, upload the tarball from npm pack, or push it with polyxd studio push.`);
  if (meta.status === 401 || meta.status === 403) throw new Error(`${base} refused the request (${meta.status}). The registry token may lack read access to ${name}.`);
  if (!meta.ok) throw new Error(`${base} answered ${meta.status} for ${name}`);
  const doc = (await meta.json()) as { "dist-tags"?: Record<string, string>; versions?: Record<string, { dist: { tarball: string } }> };
  const version = wanted && doc.versions?.[wanted] ? wanted : (doc["dist-tags"]?.[wanted ?? "latest"] ?? doc["dist-tags"]?.latest);
  const v = version ? doc.versions?.[version] : undefined;
  if (!version || !v) throw new Error(`${name}@${wanted ?? "latest"} isn't a version the registry lists`);
  const tarball = await fetch(v.dist.tarball, { headers: registry.token ? { authorization: `Bearer ${registry.token}` } : {} });
  if (!tarball.ok) throw new Error(`Couldn't download ${name}@${version} (${tarball.status})`);
  return { name, version, tgz: await tarball.arrayBuffer() };
}
