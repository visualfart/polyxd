/**
 * The Worker, run in Node for tests: D1 as an in-memory SQLite database (node:sqlite) with every
 * migration applied, R2 as a map, and the Worker's module loaded with the two things only
 * wrangler's bundler knows how to import (JSON without an import attribute, CSS as text).
 * Requests go through `app.request`, sign-in included, exactly as they would on Workers.
 */
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { registerHooks } from "node:module";
import { randomBytes } from "node:crypto";

registerHooks({
  load(url, context, next) {
    if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))};` };
    if (url.endsWith(".json") && context.importAttributes?.type !== "json") return { format: "module", shortCircuit: true, source: `export default ${readFileSync(new URL(url), "utf8")};` };
    return next(url, context);
  },
});

const arg = (v: unknown): SQLInputValue => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v instanceof Date ? v.toISOString() : (v as SQLInputValue));

class Statement {
  db: DatabaseSync;
  sql: string;
  params: unknown[];
  constructor(db: DatabaseSync, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params);
  }
  exec(): { rows: Record<string, unknown>[]; changes: number; lastRowId: number } {
    const s = this.db.prepare(this.sql);
    const params = this.params.map(arg);
    if (s.columns().length) {
      const rows = s.all(...params) as Record<string, unknown>[];
      const { changes, id } = this.db.prepare("SELECT changes() AS changes, last_insert_rowid() AS id").get() as { changes: number; id: number };
      return { rows, changes: /^\s*(insert|update|delete)/i.test(this.sql) ? changes : 0, lastRowId: id };
    }
    const r = s.run(...params);
    return { rows: [], changes: Number(r.changes), lastRowId: Number(r.lastInsertRowid) };
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.exec().rows[0];
    if (!row) return null;
    return (column ? row[column] : row) as T;
  }
  async all<T>() {
    const r = this.exec();
    return { results: r.rows as T[], success: true, meta: { changes: r.changes, last_row_id: r.lastRowId } };
  }
  async run() {
    const r = this.exec();
    return { results: [], success: true, meta: { changes: r.changes, last_row_id: r.lastRowId } };
  }
  async raw() {
    return this.exec().rows.map((r) => Object.values(r));
  }
}

class D1 {
  db = new DatabaseSync(":memory:");
  constructor() {
    this.db.exec("PRAGMA foreign_keys = ON");
  }
  prepare(sql: string) {
    return new Statement(this.db, sql);
  }
  async batch(statements: Statement[]) {
    this.db.exec("BEGIN");
    try {
      const out = [];
      for (const s of statements) out.push(await s.all());
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  async exec(sql: string) {
    this.db.exec(sql);
    return { count: 1, duration: 0 };
  }
}

class R2 {
  objects = new Map<string, { body: string | ArrayBuffer; customMetadata?: Record<string, string> }>();
  async put(key: string, body: string | ArrayBuffer, opts?: { customMetadata?: Record<string, string> }) {
    this.objects.set(key, { body, customMetadata: opts?.customMetadata });
  }
  async get(key: string) {
    const o = this.objects.get(key);
    if (!o) return null;
    const text = typeof o.body === "string" ? o.body : new TextDecoder().decode(o.body);
    return { text: async () => text, json: async () => JSON.parse(text), arrayBuffer: async () => new TextEncoder().encode(text).buffer, customMetadata: o.customMetadata };
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async list({ prefix = "" }: { prefix?: string } = {}) {
    return { objects: [...this.objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
  }
}

export const APP_URL = "http://localhost:8789";

/** A fresh Worker with its own empty database, and a caller that keeps a session's cookie. `vars` are extra env (BILLING, Stripe's). */
export async function startWorker(vars: Record<string, unknown> = {}) {
  const { app, default: worker } = await import("../../src/worker/index.ts");
  const DB = new D1();
  const migrations = new URL("../../migrations/", import.meta.url);
  for (const f of readdirSync(migrations).filter((f) => f.endsWith(".sql")).sort()) DB.db.exec(readFileSync(new URL(f, migrations), "utf8"));
  // A secret made for this run only, so sessions sign as they would anywhere.
  const env = { DB, FILES: new R2(), ASSETS: { fetch: async () => new Response("", { status: 404 }) }, APP_URL, AUTH_SECRET: randomBytes(32).toString("hex"), ...vars };
  const silence = console.log;

  /** One caller: a browser session (cookies kept) or an API key (a bearer header). */
  const client = (auth: { cookie?: string; key?: string } = {}) => {
    const jar = { cookie: auth.cookie ?? "" };
    const call = async (method: string, path: string, body?: unknown) => {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers["content-type"] = "application/json";
      if (jar.cookie) headers.cookie = jar.cookie;
      if (auth.key) headers.authorization = `Bearer ${auth.key}`;
      else if (method !== "GET") headers.origin = APP_URL;
      console.log = () => undefined;
      try {
        const res = await app.request(`${APP_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
        const set = res.headers.getSetCookie?.() ?? [];
        if (set.length) jar.cookie = [...new Map([...jar.cookie.split("; ").filter(Boolean), ...set.map((c) => c.split(";")[0])].map((c) => [c.split("=")[0], c])).values()].join("; ");
        const text = await res.text();
        return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
      } finally {
        console.log = silence;
      }
    };
    return { call, jar };
  };

  /** Signs up a local test account (no email goes out locally) and makes a workspace. */
  const signUp = async (email: string, workspace: string) => {
    const person = client();
    const r = await person.call("POST", "/api/auth/sign-up/email", { name: email.split("@")[0], email, password: `test-${crypto.randomUUID()}` });
    if (r.status !== 200) throw new Error(`sign-up: ${r.status} ${JSON.stringify(r.body)}`);
    const w = await person.call("POST", "/api/workspaces", { name: workspace, slug: workspace.toLowerCase() });
    if (w.status !== 201) throw new Error(`workspace: ${w.status} ${JSON.stringify(w.body)}`);
    return person;
  };
  /** Runs the cron handler once, as the scheduler would. */
  const scheduled = async () => {
    const waits: Promise<unknown>[] = [];
    console.log = () => undefined;
    try {
      await worker.scheduled({} as ScheduledController, env as never, { waitUntil: (p: Promise<unknown>) => waits.push(p), passThroughOnException: () => undefined } as unknown as ExecutionContext);
      await Promise.all(waits);
    } finally {
      console.log = silence;
    }
  };
  return { app, env, client, signUp, scheduled };
}
