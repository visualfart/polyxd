/**
 * Support: who may use it, what it changes, and what it records. Stripe is never called: the one
 * place that would reach it (a customer's subscriptions and invoices) has global fetch replaced.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startWorker } from "./support/worker.ts";

type Worker = Awaited<ReturnType<typeof startWorker>>;
const ADMIN = { SUPER_ADMINS: "boss@polyxd.com, Other@Polyxd.com" };

async function person(worker: Worker, email: string) {
  const p = worker.client();
  const r = await p.call("POST", "/api/auth/sign-up/email", { name: email.split("@")[0], email, password: `test-${crypto.randomUUID()}` });
  assert.equal(r.status, 200);
  return p;
}

/** An invite made and accepted, so there are two people in one workspace. */
async function join(worker: Worker, owner: Awaited<ReturnType<typeof person>>, slug: string, email: string, role: string) {
  const inv = await owner.call("POST", `/api/w/${slug}/invites`, { emails: [email], role });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  const them = await person(worker, email);
  await them.call("POST", `/api/invites/${inv.body.invites[0].id}/accept`);
  return them;
}

const idOf = async (worker: Worker, slug: string) => (await worker.env.DB.prepare("SELECT id FROM workspaces WHERE slug = ?").bind(slug).first<{ id: string }>())!.id;
const one = async <T,>(worker: Worker, sql: string, ...params: unknown[]) => (await worker.env.DB.prepare(sql).bind(...params).first<T>())!;
const all = async <T,>(worker: Worker, sql: string, ...params: unknown[]) => (await worker.env.DB.prepare(sql).bind(...params).all<T>()).results;

test("support is only for the addresses in SUPER_ADMINS, and says nothing to anyone else", async () => {
  const worker = await startWorker(ADMIN);
  const boss = await person(worker, "boss@polyxd.com");
  const nosy = await person(worker, "nosy@northwind.io");
  await nosy.call("POST", "/api/workspaces", { name: "Northwind", slug: "northwind" });

  // Someone signed in who isn't on the list is told the endpoint isn't there, not that they can't.
  for (const path of ["/api/admin/overview", "/api/admin/workspaces", "/api/admin/users", "/api/admin/log"]) {
    assert.equal((await nosy.call("GET", path)).status, 404, path);
  }
  assert.equal((await worker.client().call("GET", "/api/admin/overview")).status, 401);

  const overview = await boss.call("GET", "/api/admin/overview");
  assert.equal(overview.status, 200);
  assert.equal(overview.body.workspaces, 1);
  assert.equal(overview.body.users, 2);
  assert.equal(overview.body.plans.free, 1);

  // The list is matched case-insensitively, and the spaces around an address don't count.
  const other = await person(worker, "other@polyxd.com");
  assert.equal((await other.call("GET", "/api/admin/overview")).status, 200);
});

test("a plan set by hand: the workspace changes, and what changed is recorded with a reason", async () => {
  const worker = await startWorker(ADMIN);
  const boss = await person(worker, "boss@polyxd.com");
  const ana = await person(worker, "ana@northwind.io");
  await ana.call("POST", "/api/workspaces", { name: "Northwind", slug: "northwind" });
  const id = await idOf(worker, "northwind");

  assert.equal((await boss.call("POST", `/api/admin/workspaces/${id}/plan`, { plan: "gold" })).status, 400);

  const set = await boss.call("POST", `/api/admin/workspaces/${id}/plan`, { plan: "enterprise", note: "Design partner" });
  assert.equal(set.status, 200);
  assert.equal(set.body.plan, "enterprise");
  assert.equal(set.body.subscribed, false);
  assert.equal((await one<{ plan: string }>(worker, "SELECT plan FROM workspaces WHERE id = ?", id)).plan, "enterprise");

  const log = await boss.call("GET", "/api/admin/log");
  assert.equal(log.body.actions.length, 1);
  const a = log.body.actions[0];
  assert.equal(a.admin_email, "boss@polyxd.com");
  assert.equal(a.action, "plan");
  assert.equal(JSON.parse(a.before), "free");
  assert.equal(JSON.parse(a.after), "enterprise");
  assert.equal(a.note, "Design partner");
  assert.equal(a.workspace_slug, "northwind");

  // The workspace now has an enterprise workspace's limits, not Free's.
  const detail = await boss.call("GET", `/api/admin/workspaces/${id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.usage.plan, "enterprise");
  assert.equal(detail.body.usage.limits.designSystems, null);
  assert.equal(detail.body.stripe.customer, null);
});

test("a workspace handed to someone else keeps exactly one owner, and the old owner stays as an admin", async () => {
  const worker = await startWorker(ADMIN);
  const boss = await person(worker, "boss@polyxd.com");
  const ana = await person(worker, "ana@northwind.io");
  await ana.call("POST", "/api/workspaces", { name: "Northwind", slug: "northwind" });
  const leo = await join(worker, ana, "northwind", "leo@northwind.io", "designer");
  const id = await idOf(worker, "northwind");
  const users = await all<{ id: string; email: string }>(worker, "SELECT id, email FROM user");
  const leoId = users.find((u) => u.email === "leo@northwind.io")!.id;
  const anaId = users.find((u) => u.email === "ana@northwind.io")!.id;

  // Ana hands it over herself, from the Team page.
  assert.equal((await ana.call("POST", "/api/w/northwind/owner", { user: leoId })).status, 200);
  const roles = async () => Object.fromEntries((await all<{ user_id: string; role: string }>(worker, "SELECT user_id, role FROM memberships WHERE workspace_id = ?", id)).map((m) => [m.user_id, m.role]));
  assert.deepEqual(await roles(), { [anaId]: "admin", [leoId]: "owner" });

  // She can't take it back: she is an admin now, and only the owner may hand it on.
  assert.equal((await ana.call("POST", "/api/w/northwind/owner", { user: anaId })).status, 403);
  // Nor can anyone remove the owner; the workspace would have none.
  assert.equal((await ana.call("DELETE", `/api/w/northwind/members/${leoId}`)).status, 409);

  // Support can step in when the owner has gone, and it is recorded.
  assert.equal((await boss.call("POST", `/api/admin/workspaces/${id}/owner`, { user: anaId, note: "Leo left the company" })).status, 200);
  assert.deepEqual(await roles(), { [anaId]: "owner", [leoId]: "admin" });
  const log = await boss.call("GET", "/api/admin/log");
  assert.equal(log.body.actions[0].action, "owner");
  assert.equal(log.body.actions[0].note, "Leo left the company");
  void leo;
});

test("an admin runs the workspace: people, roles and billing, but never the handover", async () => {
  const worker = await startWorker({ ...ADMIN, BILLING: "on" });
  const ana = await person(worker, "ana@northwind.io");
  await ana.call("POST", "/api/workspaces", { name: "Northwind", slug: "northwind" });
  const mia = await join(worker, ana, "northwind", "mia@northwind.io", "admin");
  await join(worker, ana, "northwind", "leo@northwind.io", "viewer");
  // On Team, so seats aren't what this test is about: Free stops at two editors.
  await worker.env.DB.prepare("UPDATE workspaces SET plan = 'team' WHERE slug = 'northwind'").run();
  const leoId = (await one<{ id: string }>(worker, "SELECT id FROM user WHERE email = ?", "leo@northwind.io")).id;

  // An admin may invite, change a role and see billing.
  assert.equal((await mia.call("POST", "/api/w/northwind/invites", { emails: ["sam@northwind.io"], role: "designer" })).status, 201);
  assert.equal((await mia.call("GET", "/api/w/northwind/billing")).status, 200);
  assert.equal((await mia.call("PATCH", `/api/w/northwind/members/${leoId}`, { role: "engineer" })).status, 200);
  assert.equal((await one<{ role: string }>(worker, "SELECT role FROM memberships WHERE user_id = ?", leoId)).role, "engineer");

  // Nobody is made an owner by a role change; that is what the handover is for.
  const bad = await mia.call("PATCH", `/api/w/northwind/members/${leoId}`, { role: "owner" });
  assert.equal(bad.status, 400);
  // And an admin cannot hand the workspace on.
  assert.equal((await mia.call("POST", "/api/w/northwind/owner", { user: leoId })).status, 403);
});

test("what Stripe says about a customer is read, never written, and a failure doesn't hide the rest", async () => {
  const worker = await startWorker({ ...ADMIN, BILLING: "on", STRIPE_SECRET_KEY: "sk_test_fake" });
  const boss = await person(worker, "boss@polyxd.com");
  const ana = await person(worker, "ana@northwind.io");
  await ana.call("POST", "/api/workspaces", { name: "Northwind", slug: "northwind" });
  const id = await idOf(worker, "northwind");
  await worker.env.DB.prepare("UPDATE workspaces SET stripe_customer_id = ?, plan = 'team' WHERE id = ?").bind("cus_1", id).run();

  const calls: string[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("https://api.stripe.com")) return real(input as RequestInfo, init);
    calls.push(`${init?.method ?? "GET"} ${url.split("?")[0].replace("https://api.stripe.com/v1", "")}`);
    const body = url.includes("/subscriptions")
      ? { data: [{ id: "sub_1", status: "active", items: { data: [{ quantity: 3, price: { id: "price_team_month", unit_amount: 1200, currency: "usd" } }] } }] }
      : { data: [{ id: "in_1", number: "A-1", status: "paid", total: 3600, currency: "usd", created: 1_790_000_000, hosted_invoice_url: "https://pay.stripe.com/x" }] };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const detail = await boss.call("GET", `/api/admin/workspaces/${id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.stripe.subscriptions[0].quantity, 3);
    assert.equal(detail.body.stripe.subscriptions[0].amount, 1200);
    assert.equal(detail.body.stripe.invoices[0].number, "A-1");
    assert.equal(detail.body.stripe.error, null);
    // Only reads: support can look at a subscription, never change or cancel it.
    assert.ok(calls.every((c) => c.startsWith("GET ")), calls.join(", "));

    // Stripe down: the page still answers, with the rest of the workspace and the reason.
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!String(input).startsWith("https://api.stripe.com")) return real(input as RequestInfo, init);
      return new Response(JSON.stringify({ error: { message: "Stripe is having a moment" } }), { status: 500, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const broken = await boss.call("GET", `/api/admin/workspaces/${id}`);
    assert.equal(broken.status, 200);
    assert.match(broken.body.stripe.error, /moment|500/);
    assert.equal(broken.body.members.length, 1);
  } finally {
    globalThis.fetch = real;
  }
});

test("support finds a workspace by slug, name or the owner's address, and a person by either", async () => {
  const worker = await startWorker(ADMIN);
  const boss = await person(worker, "boss@polyxd.com");
  const ana = await person(worker, "ana@northwind.io");
  await ana.call("POST", "/api/workspaces", { name: "Northwind Bank", slug: "northwind" });
  const harbour = await person(worker, "sam@harbourline.com");
  await harbour.call("POST", "/api/workspaces", { name: "Harbourline", slug: "harbourline" });

  const by = async (q: string) => (await boss.call("GET", `/api/admin/workspaces?q=${encodeURIComponent(q)}`)).body.workspaces.map((w: { slug: string }) => w.slug);
  assert.deepEqual(await by("harbour"), ["harbourline"]);
  assert.deepEqual(await by("Northwind Bank"), ["northwind"]);
  assert.deepEqual(await by("ana@northwind.io"), ["northwind"]);
  assert.equal((await by("")).length, 2);

  const all = (await boss.call("GET", "/api/admin/workspaces")).body.workspaces;
  assert.equal(all.find((w: { slug: string }) => w.slug === "northwind").owner_email, "ana@northwind.io");

  const people = (await boss.call("GET", "/api/admin/users?q=harbourline")).body.users;
  assert.deepEqual(people.map((u: { email: string }) => u.email), ["sam@harbourline.com"]);
  assert.equal(people[0].workspaces, 1);
});
