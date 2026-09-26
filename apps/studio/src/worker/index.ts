/**
 * Polyxd Studio's API, on Cloudflare Workers: Hono for routing, D1 for records, R2 for token
 * graphs and uploaded files. The React app in dist/ is served as static assets; /api/* comes here.
 */
import { Hono } from "hono";
import contract from "@polyxd/spec/tokens/semantic-contract.json";
import catalog from "@polyxd/spec/catalog/catalog.json";
import { read, resolve, index, type Graph } from "../import/read.ts";
import { scan } from "../import/scan.ts";
import { mapRoles, candidatesFor, scalar, type Contract, type Override } from "../import/map.ts";
import { checkRegistryUrl, fetchPackage, findTokenFiles, untar } from "../import/package.ts";
import { decrypt, encrypt, newApiKey, sha256 } from "./crypto.ts";
import { isLocal, makeAuth, now, sendEmail, userFromRequest, type Ctx, type Env, type User } from "./auth.ts";

type Vars = { user: User | null; apiWorkspace: string | null };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();
const CONTRACT = contract as unknown as Contract;
const ROLES = ["owner", "design-system", "designer", "product", "engineer", "viewer"] as const;
const CAN_EDIT_TOKENS = new Set(["owner", "design-system", "engineer"]);
const CAN_EDIT_RULES = new Set(["owner", "design-system", "designer"]);
const secretsKey = (env: Env) => env.SECRETS_KEY ?? (isLocal(env) ? "dev-only-not-a-secret" : "");

class Fail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
app.onError((e, c) => {
  if (e instanceof Fail) return c.json({ error: e.message }, e.status as 500);
  console.error(e);
  return c.json({ error: "Something went wrong on our side" }, 500);
});

/** The request's JSON body, or a 400 that says so. */
const body = async <T,>(c: Ctx): Promise<T> => {
  try {
    return (await c.req.json()) as T;
  } catch {
    throw new Fail(400, "Send a JSON body");
  }
};
const text = (v: unknown, max: number, what: string): string => {
  if (typeof v !== "string" || v.length > max) throw new Fail(400, `${what}: text of up to ${max} characters`);
  return v;
};

const MAX_UPLOAD = 25 * 1024 * 1024;

app.on(["GET", "POST"], "/api/auth/*", (c) => makeAuth(c.env).handler(c.req.raw));

app.use("/api/*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Cache-Control", "no-store");
  // A browser sends Origin on every cross-site request that could change something; a request
  // that changes something and comes from anywhere but this app is refused, whatever cookies it
  // carries. API-key calls (curl, the push command) send no Origin and no cookie, so they pass.
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    const bearer = c.req.header("authorization")?.startsWith("Bearer ");
    if (origin && new URL(origin).origin !== new URL(c.env.APP_URL).origin && !bearer) throw new Fail(403, "Cross-site request refused");
    const len = Number(c.req.header("content-length") ?? 0);
    if (len > MAX_UPLOAD) throw new Fail(413, "That's over 25 MB");
  }
  const { user, apiWorkspace } = await userFromRequest(c as Ctx, makeAuth(c.env));
  c.set("user", user);
  c.set("apiWorkspace", apiWorkspace);
  await next();
});

const need = (c: Ctx): User => {
  const u = c.get("user");
  if (!u) throw new Fail(401, "Sign in first");
  return u;
};

interface Workspace {
  id: string;
  slug: string;
  name: string;
  role: string;
}

/** The workspace in the URL, and the caller's role in it. */
async function ws(c: Ctx, allowed?: ReadonlySet<string>): Promise<Workspace> {
  const user = need(c);
  const slug = c.req.param("slug");
  const row = await c.env.DB.prepare(
    "SELECT w.id, w.slug, w.name, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE w.slug = ? AND m.user_id = ?",
  ).bind(slug, user.id).first<Workspace>();
  if (!row) throw new Fail(404, "No such workspace, or you're not in it");
  // An API key is scoped to one workspace, and to importing: whatever its creator can do in the
  // app, a key kept in CI can push token packages and read design systems, nothing else.
  const api = c.get("apiWorkspace");
  if (api) {
    if (api !== row.id) throw new Fail(403, "This key belongs to another workspace");
    const path = new URL(c.req.url).pathname;
    const importing = c.req.method === "POST" && path.endsWith("/design-systems/import");
    const reading = c.req.method === "GET" && path.includes("/design-systems");
    if (!importing && !reading) throw new Fail(403, "An API key can import and read design systems only");
  }
  if (allowed && !allowed.has(row.role)) throw new Fail(403, `Your role (${row.role}) can't do that`);
  return row;
}

// ---------------------------------------------------------------- sign in and out

app.get("/api/me", async (c) => {
  const user = c.get("user");
  const signIn = { google: !!(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET), emailVerification: !isLocal(c.env) };
  if (!user) return c.json({ user: null, workspaces: [], signIn });
  const workspaces = await c.env.DB.prepare("SELECT w.id, w.slug, w.name, m.role FROM workspaces w JOIN memberships m ON m.workspace_id = w.id WHERE m.user_id = ? ORDER BY w.name")
    .bind(user.id).all<Workspace>();
  return c.json({ user, workspaces: workspaces.results, signIn });
});

// ---------------------------------------------------------------- workspaces, members, invites

app.post("/api/workspaces", async (c) => {
  const user = need(c as Ctx);
  const { name, slug } = await body<{ name?: string; slug?: string }>(c as Ctx);
  if (name !== undefined) text(name, 80, "Name");
  const s = (slug ?? name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!name?.trim() || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(s)) throw new Fail(400, "A name, and an address of letters, digits and dashes");
  const taken = await c.env.DB.prepare("SELECT 1 FROM workspaces WHERE slug = ?").bind(s).first();
  if (taken) throw new Fail(409, `studio.polyxd.com/${s} is taken`);
  const id = crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO workspaces (id, slug, name, created_at) VALUES (?, ?, ?, ?)").bind(id, s, name.trim(), now()),
    c.env.DB.prepare("INSERT INTO memberships (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").bind(id, user.id, now()),
  ]);
  return c.json({ id, slug: s, name: name.trim(), role: "owner" }, 201);
});

app.get("/api/w/:slug", async (c) => {
  const w = await ws(c as Ctx);
  const members = await c.env.DB.prepare("SELECT u.id, u.email, u.name, m.role, m.created_at FROM memberships m JOIN user u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at")
    .bind(w.id).all();
  const invites = await c.env.DB.prepare("SELECT id, email, role, created_at, expires_at FROM invites WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > ?").bind(w.id, now()).all();
  return c.json({ ...w, members: members.results, invites: invites.results });
});

app.post("/api/w/:slug/invites", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "design-system"]));
  const user = need(c as Ctx);
  const { emails, role, message } = await body<{ emails?: string[]; role?: string; message?: string }>(c as Ctx);
  if (!role || !ROLES.includes(role as (typeof ROLES)[number]) || role === "owner") throw new Fail(400, "Pick a role other than owner");
  if (message !== undefined) text(message, 500, "Message");
  const list = [...new Set((Array.isArray(emails) ? emails : []).map((e) => String(e).trim().toLowerCase()).filter((e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(e)))];
  if (!list.length) throw new Fail(400, "Enter at least one email address");
  if (list.length > 50) throw new Fail(400, "Up to 50 invites at a time");
  const members = await c.env.DB.prepare("SELECT u.email FROM memberships m JOIN user u ON u.id = m.user_id WHERE m.workspace_id = ?").bind(w.id).all<{ email: string }>();
  const already = list.filter((e) => members.results.some((m) => m.email === e));
  if (already.length) throw new Fail(409, `${already.join(", ")} ${already.length === 1 ? "is" : "are"} already in this workspace`);
  const made = [];
  for (const email of list) {
    const id = crypto.randomUUID();
    await c.env.DB.prepare("INSERT INTO invites (id, workspace_id, email, role, message, invited_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, w.id, email, role, message ?? "", user.id, now(), new Date(Date.now() + 7 * 86400e3).toISOString()).run();
    const link = `${c.env.APP_URL}/invite/${id}`;
    const sent = await sendEmail(c.env, email, `${user.name || user.email} invited you to ${w.name} on Polyxd Studio`, `<div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #141414;"><h2 style="font-size: 20px; margin: 0 0 12px;">Join ${w.name} on Studio</h2><p style="font-size: 15px; line-height: 22px;">${user.name || user.email} invited you as ${role}.${message ? ` “${String(message).replace(/[<>]/g, "")}”` : ""}</p><p><a href="${link}" style="display: inline-block; background: #141414; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600;">Accept the invite</a></p><p style="font-size: 12px; color: #5e5c55;">It expires in 7 days. Or paste this into your browser: ${link}</p></div>`);
    // Without an email sender, the link comes back so the inviter can pass it on.
    made.push({ id, email, link: sent ? undefined : link, sent });
  }
  return c.json({ invites: made }, 201);
});

app.get("/api/invites/:id", async (c) => {
  const inv = await c.env.DB.prepare(
    "SELECT i.id, i.email, i.role, i.message, i.expires_at, i.accepted_at, w.name AS workspace, u.name AS inviter FROM invites i JOIN workspaces w ON w.id = i.workspace_id JOIN user u ON u.id = i.invited_by WHERE i.id = ?",
  ).bind(c.req.param("id")).first();
  if (!inv) throw new Fail(404, "That invite doesn't exist");
  // The link is the credential; the page still needn't spell the whole address out.
  const [local, domain] = String((inv as { email: string }).email).split("@");
  return c.json({ ...inv, email: `${local[0]}***@${domain}` });
});

app.post("/api/invites/:id/accept", async (c) => {
  const user = need(c as Ctx);
  const inv = await c.env.DB.prepare("SELECT id, workspace_id, email, role, expires_at, accepted_at FROM invites WHERE id = ?").bind(c.req.param("id"))
    .first<{ id: string; workspace_id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>();
  if (!inv || inv.accepted_at || inv.expires_at < now()) throw new Fail(410, "That invite has expired or was already used");
  if (inv.email !== user.email) throw new Fail(403, "This invite is for a different email address");
  const member = await c.env.DB.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND user_id = ?").bind(inv.workspace_id, user.id).first();
  if (member) throw new Fail(409, "You're already in this workspace; an invite can't change your role");
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO memberships (workspace_id, user_id, role, created_at) VALUES (?, ?, ?, ?)").bind(inv.workspace_id, user.id, inv.role, now()),
    c.env.DB.prepare("UPDATE invites SET accepted_at = ? WHERE id = ?").bind(now(), inv.id),
  ]);
  const w = await c.env.DB.prepare("SELECT slug FROM workspaces WHERE id = ?").bind(inv.workspace_id).first<{ slug: string }>();
  return c.json({ slug: w?.slug });
});

// ---------------------------------------------------------------- registries and API keys

app.get("/api/w/:slug/registries", async (c) => {
  const w = await ws(c as Ctx);
  const rows = await c.env.DB.prepare("SELECT id, url, scope, token_enc IS NOT NULL AS has_token, created_at FROM registries WHERE workspace_id = ?").bind(w.id).all();
  return c.json({ registries: rows.results });
});

app.post("/api/w/:slug/registries", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const user = need(c as Ctx);
  const { url, scope, token } = await body<{ url?: string; scope?: string; token?: string }>(c as Ctx);
  if (token !== undefined) text(token, 500, "Token");
  let clean: string;
  try {
    clean = checkRegistryUrl(url ?? "");
  } catch (e) {
    throw new Fail(400, (e as Error).message);
  }
  if (scope && !/^@[a-z0-9][\w.-]*$/i.test(scope)) throw new Fail(400, "A scope looks like @acme");
  if (!secretsKey(c.env)) throw new Fail(500, "SECRETS_KEY isn't set, so a token can't be stored safely");
  const enc = token ? await encrypt(token, secretsKey(c.env)) : null;
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO registries (id, workspace_id, url, scope, token_enc, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, w.id, clean, scope ?? "", enc, user.id, now()).run();
  return c.json({ id }, 201);
});

app.delete("/api/w/:slug/registries/:id", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  await c.env.DB.prepare("DELETE FROM registries WHERE id = ? AND workspace_id = ?").bind(c.req.param("id"), w.id).run();
  return c.json({ ok: true });
});

app.get("/api/w/:slug/api-keys", async (c) => {
  const w = await ws(c as Ctx);
  const rows = await c.env.DB.prepare("SELECT id, name, created_at, last_used_at FROM api_keys WHERE workspace_id = ?").bind(w.id).all();
  return c.json({ keys: rows.results });
});

app.post("/api/w/:slug/api-keys", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "engineer", "design-system"]));
  const user = need(c as Ctx);
  const { name } = await body<{ name?: string }>(c as Ctx);
  if (name !== undefined) text(name, 80, "Name");
  const key = newApiKey();
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO api_keys (id, workspace_id, name, key_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, w.id, name?.trim() || "polyxd studio push", await sha256(key), user.id, now()).run();
  // The only time the key is shown.
  return c.json({ id, key }, 201);
});

app.delete("/api/w/:slug/api-keys/:id", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "engineer", "design-system"]));
  await c.env.DB.prepare("DELETE FROM api_keys WHERE id = ? AND workspace_id = ?").bind(c.req.param("id"), w.id).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- design systems: import

interface DS {
  id: string;
  workspace_id: string;
  name: string;
  source: string;
  is_default: number;
  created_at: string;
}
interface Version {
  id: string;
  design_system_id: string;
  number: number;
  status: string;
  file_name: string;
  scan_json: string;
  package_name: string | null;
  package_version: string | null;
  created_at: string;
  published_at: string | null;
}

const graphKey = (versionId: string) => `versions/${versionId}/graph.json`;

async function loadGraph(env: Env, versionId: string): Promise<Graph> {
  const obj = await env.FILES.get(graphKey(versionId));
  if (!obj) throw new Fail(404, "This version's tokens are gone");
  return (await obj.json()) as Graph;
}

/** Reads token files from whatever arrived: a JSON or CSS file, a tarball, or a package name. */
async function graphFrom(c: Ctx, w: Workspace, body: Record<string, string | File>): Promise<{ graph: Graph; source: string; fileName: string; pkg?: { name: string; version: string }; picked: string[]; original?: { name: string; bytes: ArrayBuffer } }> {
  const file = body.file instanceof File ? body.file : null;
  const pkgSpec = typeof body.package === "string" ? body.package.trim() : "";
  if (pkgSpec) {
    // A private registry for the package's scope, if the workspace has one.
    const scope = pkgSpec.startsWith("@") ? pkgSpec.split("/")[0] : "";
    const reg = await c.env.DB.prepare("SELECT url, scope, token_enc FROM registries WHERE workspace_id = ? ORDER BY (scope = ?) DESC, (scope = '') DESC LIMIT 1")
      .bind(w.id, scope).first<{ url: string; scope: string; token_enc: string | null }>();
    const registry = reg && (reg.scope === scope || reg.scope === "") ? { url: reg.url, token: reg.token_enc ? await decrypt(reg.token_enc, secretsKey(c.env)) : undefined } : undefined;
    const pkg = await fetchPackage(pkgSpec, registry);
    const files = findTokenFiles(await untar(pkg.tgz));
    if (!files.length) throw new Fail(422, `${pkg.name}@${pkg.version} has no token files Studio recognises (JSON with values, or CSS with custom properties)`);
    const best = files[0];
    return { graph: read(best.text, best.path), source: "package", fileName: `${pkg.name}@${pkg.version}/${best.path}`, pkg: { name: pkg.name, version: pkg.version }, picked: files.slice(0, 6).map((f) => f.path) };
  }
  if (!file) throw new Fail(400, "Send a file, or a package name");
  if (file.size > MAX_UPLOAD) throw new Fail(413, "That file is over 25 MB");
  const name = file.name.replace(/[^\w.@-]+/g, "_").slice(0, 120);
  if (/\.(tgz|tar\.gz)$/i.test(name)) {
    const bytes = await file.arrayBuffer();
    const files = findTokenFiles(await untar(bytes));
    if (!files.length) throw new Fail(422, `${name} has no token files Studio recognises`);
    const best = files[0];
    return { graph: read(best.text, best.path), source: "tarball", fileName: `${name}/${best.path}`, picked: files.slice(0, 6).map((f) => f.path), original: { name, bytes } };
  }
  const text = await file.text();
  return { graph: read(text, name), source: /\.css$/i.test(name) ? "css" : "file", fileName: name, picked: [name], original: { name, bytes: new TextEncoder().encode(text).buffer as ArrayBuffer } };
}

app.post("/api/w/:slug/design-systems/import", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const user = need(c as Ctx);
  const body = await c.req.parseBody();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;
  const into = typeof body.designSystemId === "string" ? body.designSystemId : null;
  let got;
  try {
    got = await graphFrom(c as Ctx, w, body);
  } catch (e) {
    if (e instanceof Fail) throw e;
    // Reader and registry errors are written for people; anything else is ours to look at.
    if (e instanceof TypeError || e instanceof RangeError) {
      console.error(e);
      throw new Fail(422, "Studio couldn't read that. If it's a file you'd expect to work, tell us which.");
    }
    throw new Fail(422, (e as Error).message);
  }
  const { graph, source, fileName, pkg, picked, original } = got;
  const summary = scan(graph);
  const dsId = into ?? crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const statements = [];
  let number = 1;
  if (into) {
    const ds = await c.env.DB.prepare("SELECT id FROM design_systems WHERE id = ? AND workspace_id = ?").bind(into, w.id).first();
    if (!ds) throw new Fail(404, "No such design system here");
    const last = await c.env.DB.prepare("SELECT MAX(number) AS n FROM ds_versions WHERE design_system_id = ?").bind(into).first<{ n: number | null }>();
    number = (last?.n ?? 0) + 1;
  } else {
    const first = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM design_systems WHERE workspace_id = ?").bind(w.id).first<{ n: number }>();
    statements.push(
      c.env.DB.prepare("INSERT INTO design_systems (id, workspace_id, name, source, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(dsId, w.id, name ?? pkg?.name ?? fileName.replace(/\.[^.]+$/, ""), graph.format === "css" ? "css" : source === "package" ? "package" : graph.format, first?.n ? 0 : 1, now()),
    );
  }
  statements.push(
    c.env.DB.prepare("INSERT INTO ds_versions (id, design_system_id, number, status, file_name, scan_json, package_name, package_version, created_by, created_at) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)")
      .bind(versionId, dsId, number, fileName, JSON.stringify({ ...summary, picked }), pkg?.name ?? null, pkg?.version ?? null, user.id, now()),
  );
  await c.env.FILES.put(graphKey(versionId), JSON.stringify(graph), { httpMetadata: { contentType: "application/json" } });
  if (original) await c.env.FILES.put(`versions/${versionId}/original`, original.bytes, { customMetadata: { name: original.name } });
  await c.env.DB.batch(statements);
  return c.json({ designSystemId: dsId, versionId, number, scan: { ...summary, picked } }, 201);
});

// ---------------------------------------------------------------- design systems: read, map, publish, delete

app.get("/api/w/:slug/design-systems", async (c) => {
  const w = await ws(c as Ctx);
  const rows = await c.env.DB.prepare(
    `SELECT d.id, d.name, d.source, d.is_default, d.created_at,
       (SELECT COUNT(*) FROM ds_versions v WHERE v.design_system_id = d.id) AS versions,
       (SELECT v.scan_json FROM ds_versions v WHERE v.design_system_id = d.id ORDER BY v.number DESC LIMIT 1) AS scan_json,
       (SELECT v.status FROM ds_versions v WHERE v.design_system_id = d.id ORDER BY v.number DESC LIMIT 1) AS status,
       (SELECT v.id FROM ds_versions v WHERE v.design_system_id = d.id ORDER BY v.number DESC LIMIT 1) AS latest_version_id
     FROM design_systems d WHERE d.workspace_id = ? ORDER BY d.is_default DESC, d.name`,
  ).bind(w.id).all<DS & { versions: number; scan_json: string | null; status: string | null; latest_version_id: string | null }>();
  return c.json({ designSystems: rows.results.map((r) => ({ ...r, scan: r.scan_json ? JSON.parse(r.scan_json) : null, scan_json: undefined })) });
});

async function version(c: Ctx, w: Workspace): Promise<{ ds: DS; v: Version }> {
  const ds = await c.env.DB.prepare("SELECT * FROM design_systems WHERE id = ? AND workspace_id = ?").bind(c.req.param("id"), w.id).first<DS>();
  if (!ds) throw new Fail(404, "No such design system here");
  const vid = c.req.param("v");
  const v = vid
    ? await c.env.DB.prepare("SELECT * FROM ds_versions WHERE id = ? AND design_system_id = ?").bind(vid, ds.id).first<Version>()
    : await c.env.DB.prepare("SELECT * FROM ds_versions WHERE design_system_id = ? ORDER BY number DESC LIMIT 1").bind(ds.id).first<Version>();
  if (!v) throw new Fail(404, "No such version");
  return { ds, v };
}

app.get("/api/w/:slug/design-systems/:id", async (c) => {
  const w = await ws(c as Ctx);
  const { ds } = await version(c as Ctx, w);
  const versions = await c.env.DB.prepare("SELECT id, number, status, file_name, package_name, package_version, created_at, published_at, scan_json FROM ds_versions WHERE design_system_id = ? ORDER BY number DESC").bind(ds.id).all<Version>();
  return c.json({ ...ds, versions: versions.results.map((v) => ({ ...v, scan: JSON.parse(v.scan_json), scan_json: undefined })) });
});

async function overrides(env: Env, versionId: string): Promise<Override[]> {
  const rows = await env.DB.prepare("SELECT role, token_path FROM role_overrides WHERE version_id = ?").bind(versionId).all<{ role: string; token_path: string | null }>();
  return rows.results.map((r) => ({ role: r.role, token: r.token_path }));
}

app.get("/api/w/:slug/design-systems/:id/versions/:v/mapping", async (c) => {
  const w = await ws(c as Ctx);
  const { v } = await version(c as Ctx, w);
  const graph = await loadGraph(c.env, v.id);
  const rows = mapRoles(graph, CONTRACT, await overrides(c.env, v.id));
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return c.json({
    modes: graph.modes.map((m) => m.name),
    rows,
    summary: { total: rows.length, mapped: rows.filter((r) => r.token).length, exact: count("exact"), guessed: count("guessed"), missing: count("missing"), fails: count("fails"), primitive: count("primitive"), off: count("off") },
  });
});

app.get("/api/w/:slug/design-systems/:id/versions/:v/candidates", async (c) => {
  const w = await ws(c as Ctx);
  const { v } = await version(c as Ctx, w);
  const role = c.req.query("role");
  if (!role || !CONTRACT.tokens[role]) throw new Fail(400, "Which role?");
  const graph = await loadGraph(c.env, v.id);
  const rows = mapRoles(graph, CONTRACT, await overrides(c.env, v.id));
  return c.json({ candidates: candidatesFor(graph, CONTRACT, rows, role, c.req.query("q") ?? "") });
});

app.put("/api/w/:slug/design-systems/:id/versions/:v/mapping", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const user = need(c as Ctx);
  const { v } = await version(c as Ctx, w);
  if (v.status !== "draft") throw new Fail(409, "This version is live. Import or duplicate it to make a new draft.");
  const { role, token, reset } = await body<{ role?: string; token?: string | null; reset?: boolean }>(c as Ctx);
  if (!role || !CONTRACT.tokens[role]) throw new Fail(400, "Which role?");
  if (reset) {
    await c.env.DB.prepare("DELETE FROM role_overrides WHERE version_id = ? AND role = ?").bind(v.id, role).run();
  } else {
    if (token) {
      const graph = await loadGraph(c.env, v.id);
      if (!index(graph).has(token)) throw new Fail(404, `${token} isn't a token in this version`);
    }
    await c.env.DB.prepare("INSERT OR REPLACE INTO role_overrides (version_id, role, token_path, decided_by, decided_at) VALUES (?, ?, ?, ?, ?)")
      .bind(v.id, role, token ?? null, user.id, now()).run();
  }
  return c.json({ ok: true });
});

/** Accepts every guess that came from a name at once: the 70-odd a person shouldn't have to click. */
app.post("/api/w/:slug/design-systems/:id/versions/:v/accept-exact", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const user = need(c as Ctx);
  const { v } = await version(c as Ctx, w);
  const graph = await loadGraph(c.env, v.id);
  const rows = mapRoles(graph, CONTRACT, await overrides(c.env, v.id));
  const exact = rows.filter((r) => r.how === "named" && r.token && r.status === "exact");
  if (exact.length) {
    await c.env.DB.batch(exact.map((r) => c.env.DB.prepare("INSERT OR REPLACE INTO role_overrides (version_id, role, token_path, decided_by, decided_at) VALUES (?, ?, ?, ?, ?)").bind(v.id, r.role, r.token, user.id, now())));
  }
  return c.json({ accepted: exact.length });
});

app.get("/api/w/:slug/design-systems/:id/versions/:v/tokens", async (c) => {
  const w = await ws(c as Ctx);
  const { v } = await version(c as Ctx, w);
  const graph = await loadGraph(c.env, v.id);
  const q = (c.req.query("q") ?? "").toLowerCase();
  const set = c.req.query("set") ?? "";
  const tier = c.req.query("tier") ?? "";
  const prefix = c.req.query("prefix") ?? "";
  const mode = graph.modes.find((m) => m.name === c.req.query("mode")) ?? graph.modes[0];
  const byPath = index(graph);
  // Who points at what, so a token's page can say where it reaches.
  const usedBy = new Map<string, number>();
  for (const t of graph.tokens) if (t.alias) usedBy.set(t.alias, (usedBy.get(t.alias) ?? 0) + 1);
  const tokens = graph.tokens
    .filter((t) => (!q || t.path.toLowerCase().includes(q)) && (!set || t.set === set) && (!tier || t.tier === tier) && (!prefix || t.path.startsWith(prefix)))
    .slice(0, 500)
    .map((t) => {
      const r = resolve(graph, t.path, mode, byPath);
      return { ...t, resolved: scalar(r.value), chain: r.chain, usedBy: usedBy.get(t.path) ?? 0, broken: t.alias !== null && r.leaf === undefined };
    });
  // The tree's first level: groups with counts, for the side navigation.
  const groups = new Map<string, number>();
  for (const t of graph.tokens) {
    const g = `${t.tier}/${t.path.split(".")[0]}`;
    groups.set(g, (groups.get(g) ?? 0) + 1);
  }
  return c.json({ total: graph.tokens.length, sets: graph.sets, modes: graph.modes.map((m) => m.name), groups: [...groups.entries()].map(([g, n]) => ({ group: g, count: n })), tokens });
});

app.post("/api/w/:slug/design-systems/:id/versions/:v/publish", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const { ds, v } = await version(c as Ctx, w);
  const graph = await loadGraph(c.env, v.id);
  const rows = mapRoles(graph, CONTRACT, await overrides(c.env, v.id));
  const failing = rows.filter((r) => r.status === "fails");
  if (failing.length) throw new Fail(409, `${failing.length} role(s) fail contrast: ${failing.map((r) => r.role).join(", ")}. Fix them, or leave them unmapped on purpose, before publishing.`);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE ds_versions SET status = 'retired' WHERE design_system_id = ? AND status = 'live'").bind(ds.id),
    c.env.DB.prepare("UPDATE ds_versions SET status = 'live', published_at = ? WHERE id = ?").bind(now(), v.id),
  ]);
  return c.json({ ok: true, live: v.number });
});

app.post("/api/w/:slug/design-systems/:id/default", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_TOKENS);
  const { ds } = await version(c as Ctx, w);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE design_systems SET is_default = 0 WHERE workspace_id = ?").bind(w.id),
    c.env.DB.prepare("UPDATE design_systems SET is_default = 1 WHERE id = ?").bind(ds.id),
  ]);
  return c.json({ ok: true });
});

app.delete("/api/w/:slug/design-systems/:id", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "design-system"]));
  const { ds } = await version(c as Ctx, w);
  const { confirm } = await body<{ confirm?: string }>(c as Ctx).catch(() => ({ confirm: undefined }));
  if (confirm !== ds.name) throw new Fail(400, `Type the design system's name, ${ds.name}, to confirm`);
  const versions = await c.env.DB.prepare("SELECT id FROM ds_versions WHERE design_system_id = ?").bind(ds.id).all<{ id: string }>();
  await c.env.DB.prepare("DELETE FROM design_systems WHERE id = ?").bind(ds.id).run();
  // Files go after the rows, so a failure here leaves nothing that looks alive.
  for (const v of versions.results) {
    const list = await c.env.FILES.list({ prefix: `versions/${v.id}/` });
    for (const o of list.objects) await c.env.FILES.delete(o.key);
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- components

interface CatalogEntry {
  category: string;
  summary: string;
  whenToUse?: string[];
  whenNotToUse?: string[];
}
const BUILTIN = (catalog as { components: Record<string, CatalogEntry> }).components;

app.get("/api/w/:slug/components", async (c) => {
  const w = await ws(c as Ctx);
  const rows = await c.env.DB.prepare("SELECT * FROM components WHERE workspace_id = ?").bind(w.id).all<{ name: string; kind: string; enabled: number; renderer_json: string | null; guidance_json: string | null; definition_json: string | null; updated_at: string | null }>();
  const own = new Map(rows.results.map((r) => [r.name, r]));
  const list = Object.entries(BUILTIN).map(([name, e]) => {
    const r = own.get(name);
    const guidance = r?.guidance_json ? JSON.parse(r.guidance_json) : null;
    return { name, kind: "builtin", category: e.category, summary: guidance?.summary ?? e.summary, whenToUse: guidance?.whenToUse ?? e.whenToUse ?? [], whenNotToUse: guidance?.whenNotToUse ?? e.whenNotToUse ?? [], enabled: r ? !!r.enabled : true, renderer: r?.renderer_json ? JSON.parse(r.renderer_json) : null, updatedAt: r?.updated_at ?? null };
  });
  for (const r of rows.results) {
    if (r.kind !== "custom") continue;
    const d = r.definition_json ? JSON.parse(r.definition_json) : {};
    const guidance = r.guidance_json ? JSON.parse(r.guidance_json) : {};
    list.push({ name: r.name, kind: "custom", category: d.category ?? "custom", summary: guidance.summary ?? "", whenToUse: guidance.whenToUse ?? [], whenNotToUse: guidance.whenNotToUse ?? [], enabled: !!r.enabled, renderer: r.renderer_json ? JSON.parse(r.renderer_json) : null, updatedAt: r.updated_at });
  }
  return c.json({ components: list });
});

app.put("/api/w/:slug/components/:name", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "design-system", "engineer", "designer"]));
  const user = need(c as Ctx);
  const name = c.req.param("name");
  const b = await body<{ enabled?: boolean; renderer?: unknown; guidance?: unknown; definition?: unknown }>(c as Ctx);
  const custom = name.includes(":");
  if (JSON.stringify(b).length > 20_000) throw new Fail(400, "That's more than a component definition should be");
  const r = b.renderer as { package?: unknown; export?: unknown } | null | undefined;
  if (r) {
    if (typeof r.package !== "string" || !/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(r.package)) throw new Fail(400, "renderer.package has to be an npm package name");
    if (typeof r.export !== "string" || !/^[A-Za-z_$][\w$.]{0,120}$/.test(r.export)) throw new Fail(400, "renderer.export has to be an export name");
  }
  if (!custom && !BUILTIN[name]) throw new Fail(404, `${name} isn't a Polyxd component`);
  if (custom && !/^[a-z][a-z0-9-]*:[A-Z][A-Za-z0-9]*$/.test(name)) throw new Fail(400, "A custom component is named like acme:OrderTimeline");
  const cur = await c.env.DB.prepare("SELECT * FROM components WHERE workspace_id = ? AND name = ?").bind(w.id, name).first<{ enabled: number; renderer_json: string | null; guidance_json: string | null; definition_json: string | null }>();
  const enabled = b.enabled ?? (cur ? !!cur.enabled : true);
  const renderer = "renderer" in b ? b.renderer : cur?.renderer_json ? JSON.parse(cur.renderer_json) : null;
  const guidance = "guidance" in b ? b.guidance : cur?.guidance_json ? JSON.parse(cur.guidance_json) : null;
  const definition = "definition" in b ? b.definition : cur?.definition_json ? JSON.parse(cur.definition_json) : null;
  if (custom && !definition) throw new Fail(400, "A custom component needs a definition: props, role, agent, fallback");
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO components (workspace_id, name, kind, enabled, renderer_json, guidance_json, definition_json, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).bind(w.id, name, custom ? "custom" : "builtin", enabled ? 1 : 0, renderer ? JSON.stringify(renderer) : null, guidance ? JSON.stringify(guidance) : null, definition ? JSON.stringify(definition) : null, user.id, now()).run();
  return c.json({ ok: true });
});

app.delete("/api/w/:slug/components/:name", async (c) => {
  const w = await ws(c as Ctx, new Set(["owner", "design-system", "engineer"]));
  const name = c.req.param("name");
  if (!name.includes(":")) throw new Fail(400, "Built-in components can be turned off, not deleted");
  await c.env.DB.prepare("DELETE FROM components WHERE workspace_id = ? AND name = ?").bind(w.id, name).run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- rules

app.get("/api/w/:slug/rules", async (c) => {
  const w = await ws(c as Ctx);
  const rows = await c.env.DB.prepare("SELECT r.*, u.name AS owner FROM rules r JOIN user u ON u.id = r.created_by WHERE r.workspace_id = ? ORDER BY r.created_at DESC").bind(w.id).all<{ check_json: string }>();
  return c.json({ rules: rows.results.map((r) => ({ ...r, check: JSON.parse(r.check_json), check_json: undefined })) });
});

app.post("/api/w/:slug/rules", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_RULES);
  const user = need(c as Ctx);
  const { name, why, severity, check } = await body<{ name?: string; why?: string; severity?: string; check?: unknown }>(c as Ctx);
  if (!name?.trim()) throw new Fail(400, "A rule needs a name");
  text(name, 160, "Name");
  if (why !== undefined) text(why, 2000, "Why");
  if (JSON.stringify(check ?? {}).length > 10_000) throw new Fail(400, "That check is too large");
  if (severity !== "error" && severity !== "warning") throw new Fail(400, "Severity is error or warning");
  if (!check || typeof check !== "object") throw new Fail(400, "A rule needs a check");
  const id = crypto.randomUUID();
  await c.env.DB.prepare("INSERT INTO rules (id, workspace_id, name, why, severity, check_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, w.id, name.trim(), why ?? "", severity, JSON.stringify(check), user.id, now(), now()).run();
  return c.json({ id }, 201);
});

app.put("/api/w/:slug/rules/:id", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_RULES);
  const b = await body<{ name?: string; why?: string; severity?: string; check?: unknown; enabled?: boolean }>(c as Ctx);
  const cur = await c.env.DB.prepare("SELECT * FROM rules WHERE id = ? AND workspace_id = ?").bind(c.req.param("id"), w.id).first<{ name: string; why: string; severity: string; check_json: string; enabled: number }>();
  if (!cur) throw new Fail(404, "No such rule");
  if (b.severity !== undefined && b.severity !== "error" && b.severity !== "warning") throw new Fail(400, "Severity is error or warning");
  if (b.name !== undefined) text(b.name, 160, "Name");
  if (b.why !== undefined) text(b.why, 2000, "Why");
  if (b.check !== undefined && JSON.stringify(b.check).length > 10_000) throw new Fail(400, "That check is too large");
  await c.env.DB.prepare("UPDATE rules SET name = ?, why = ?, severity = ?, check_json = ?, enabled = ?, updated_at = ? WHERE id = ?")
    .bind(b.name?.trim() || cur.name, b.why ?? cur.why, b.severity ?? cur.severity, b.check ? JSON.stringify(b.check) : cur.check_json, (b.enabled ?? !!cur.enabled) ? 1 : 0, now(), c.req.param("id")).run();
  return c.json({ ok: true });
});

app.delete("/api/w/:slug/rules/:id", async (c) => {
  const w = await ws(c as Ctx, CAN_EDIT_RULES);
  await c.env.DB.prepare("DELETE FROM rules WHERE id = ? AND workspace_id = ?").bind(c.req.param("id"), w.id).run();
  return c.json({ ok: true });
});

app.get("/api/contract", (c) => c.json({ roles: Object.keys(CONTRACT.tokens).length, contrastPairs: CONTRACT.contrast.length }));
app.all("/api/*", (c) => c.json({ error: "No such endpoint" }, 404));

export default app;
