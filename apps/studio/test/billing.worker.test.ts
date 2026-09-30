/**
 * Plans, limits, fetch metering and Stripe, through the Worker itself (test/support/worker.ts).
 * Two Studios: a self-hosted one (no BILLING), which has no limits and no billing at all, and
 * the hosted one (BILLING=on), where the plan table applies. Stripe and the Analytics Engine
 * SQL API are never called: global fetch is replaced for the requests that would go to them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startWorker } from "./support/worker.ts";
import { form, signPayload, verifySignature } from "../src/worker/billing.ts";
import { LIMITS } from "../src/worker/plans.ts";

type Worker = Awaited<ReturnType<typeof startWorker>>;

const STRIPE = {
  BILLING: "on",
  STRIPE_SECRET_KEY: "sk_test_fake",
  STRIPE_WEBHOOK_SECRET: "whsec_test_fake",
  STRIPE_PRICE_PRO_MONTH: "price_pro_month",
  STRIPE_PRICE_PRO_YEAR: "price_pro_year",
  STRIPE_PRICE_TEAM_MONTH: "price_team_month",
  STRIPE_PRICE_TEAM_YEAR: "price_team_year",
  STRIPE_COUPON_FOUNDING: "FOUNDING",
};

/** Someone signed up, without a workspace of their own. */
async function person(worker: Worker, email: string) {
  const p = worker.client();
  const r = await p.call("POST", "/api/auth/sign-up/email", { name: email.split("@")[0], email, password: `test-${crypto.randomUUID()}` });
  assert.equal(r.status, 200);
  return p;
}

/** An invite made and accepted; the accept's answer, and the person who joined. */
async function join(worker: Worker, owner: Awaited<ReturnType<typeof person>>, slug: string, email: string, role: string) {
  const inv = await owner.call("POST", `/api/w/${slug}/invites`, { emails: [email], role });
  assert.equal(inv.status, 201, JSON.stringify(inv.body));
  const them = await person(worker, email);
  return { ...(await them.call("POST", `/api/invites/${inv.body.invites[0].id}/accept`)), as: them };
}

const setPlan = (worker: Worker, slug: string, plan: string) => worker.env.DB.prepare("UPDATE workspaces SET plan = ? WHERE slug = ?").bind(plan, slug).run();
const row = (worker: Worker, slug: string) => worker.env.DB.prepare("SELECT * FROM workspaces WHERE slug = ?").bind(slug).first<Record<string, unknown>>();

/** Replaces fetch for the duration of fn; `answer` sees each outbound request. */
async function withFetch(answer: (url: string, init: RequestInit) => Response | Promise<Response>, fn: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => answer(String(input), init)) as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = real;
  }
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("a self-hosted Studio has no limits and no billing", async () => {
  const worker = await startWorker();
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const w = "/api/w/harbourline";
  assert.equal((await mira.call("GET", "/api/me")).body.billing, false);
  assert.deepEqual((await mira.call("GET", `${w}/billing`)).body, { enabled: false });
  // More of everything than Free allows.
  for (const name of ["Second", "Third"]) assert.equal((await mira.call("POST", "/api/workspaces", { name })).status, 201);
  assert.equal((await mira.call("POST", `${w}/invites`, { emails: ["a@x.test", "b@x.test", "c@x.test"], role: "designer" })).status, 201);
  for (const t of ["mono", "civic"]) assert.equal((await mira.call("POST", `${w}/design-systems/from-template`, { template: t })).status, 201);
  for (const name of ["One", "Two"]) assert.equal((await mira.call("POST", `${w}/directions`, { name })).status, 201);
  // No billing routes: checkout and the webhook aren't there.
  assert.equal((await mira.call("POST", `${w}/billing/checkout`, { plan: "pro", interval: "month" })).status, 404);
  assert.equal((await worker.client().call("POST", "/api/billing/webhook", {})).status, 404);
  // History is kept whole.
  assert.equal((await mira.call("POST", `${w}/screens`, { name: "Send" })).status, 201);
  for (let i = 0; i < 11; i++) assert.equal((await mira.call("POST", `${w}/screens/send/versions`, { document: (await mira.call("GET", `${w}/screens/send/versions/1`)).body.document })).status, 201);
  assert.equal((await mira.call("GET", `${w}/screens/send/versions`)).body.versions.length, 12);
});

test("Free: one workspace owned, two editors, one design system, one Direction, ten published screens", async () => {
  const worker = await startWorker({ BILLING: "on" });
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const w = "/api/w/harbourline";
  assert.equal((await mira.call("GET", "/api/me")).body.billing, true);

  // Workspaces: a Free owner owns one.
  const second = await mira.call("POST", "/api/workspaces", { name: "Second" });
  assert.equal(second.status, 402);
  assert.equal(second.body.code, "plan_limit");
  assert.equal(second.body.limit, "workspaces");
  assert.equal(second.body.plan, "free");
  assert.match(second.body.error, /Free has room for 1 workspace of your own/);
  // Owning a Pro workspace allows three.
  await setPlan(worker, "harbourline", "pro");
  assert.equal((await mira.call("POST", "/api/workspaces", { name: "Second" })).status, 201);
  assert.equal((await mira.call("POST", "/api/workspaces", { name: "Third" })).status, 201);
  assert.equal((await mira.call("POST", "/api/workspaces", { name: "Fourth" })).status, 402);
  await setPlan(worker, "harbourline", "free");

  // Editors: the owner is one; an open invite holds a seat; viewers are free.
  const two = await mira.call("POST", `${w}/invites`, { emails: ["a@x.test", "b@x.test"], role: "designer" });
  assert.equal(two.status, 402);
  assert.deepEqual([two.body.limit, two.body.current, two.body.max], ["editors", 1, 2]);
  assert.equal((await mira.call("POST", `${w}/invites`, { emails: ["a@x.test"], role: "designer" })).status, 201);
  assert.equal((await mira.call("POST", `${w}/invites`, { emails: ["b@x.test"], role: "engineer" })).status, 402);
  assert.equal((await mira.call("POST", `${w}/invites`, { emails: ["v1@x.test", "v2@x.test", "v3@x.test"], role: "viewer" })).status, 201);
  // Withdrawing the open invite frees its seat.
  const open = (await mira.call("GET", w)).body.invites.find((i: { email: string }) => i.email === "a@x.test");
  assert.equal((await mira.call("DELETE", `${w}/invites/${open.id}`)).status, 200);
  assert.equal((await join(worker, mira, "harbourline", "b@x.test", "engineer")).status, 200);

  // Design systems: import or template, one in all.
  assert.equal((await mira.call("POST", `${w}/design-systems/from-template`, { template: "mono" })).status, 201);
  const ds = await mira.call("POST", `${w}/design-systems/from-template`, { template: "civic" });
  assert.equal(ds.status, 402);
  assert.equal(ds.body.limit, "designSystems");

  // Directions.
  assert.equal((await mira.call("POST", `${w}/directions`, { name: "One" })).status, 201);
  const dir = await mira.call("POST", `${w}/directions`, { name: "Two" });
  assert.equal(dir.status, 402);
  assert.equal(dir.body.limit, "directions");

  // Published screens: ten; a new version of a published one isn't another.
  for (let i = 1; i <= 11; i++) assert.equal((await mira.call("POST", `${w}/screens`, { name: `Screen ${i}` })).status, 201);
  for (let i = 1; i <= 10; i++) assert.equal((await mira.call("POST", `${w}/screens/screen-${i}/versions/1/publish`)).status, 200);
  const eleventh = await mira.call("POST", `${w}/screens/screen-11/versions/1/publish`);
  assert.equal(eleventh.status, 402);
  assert.equal(eleventh.body.limit, "publishedScreens");
  const doc = (await mira.call("GET", `${w}/screens/screen-1/versions/1`)).body.document;
  assert.equal((await mira.call("POST", `${w}/screens/screen-1/versions`, { document: doc })).status, 201);
  assert.equal((await mira.call("POST", `${w}/screens/screen-1/versions/2/publish`)).status, 200);

  // History: the last ten versions, and the published one wherever it is.
  for (let i = 0; i < 12; i++) await mira.call("POST", `${w}/screens/screen-1/versions`, { document: doc });
  const kept = (await mira.call("GET", `${w}/screens/screen-1/versions`)).body.versions.map((v: { number: number }) => v.number);
  assert.deepEqual(kept, [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 2]);

  // The Billing page's numbers.
  const b = (await mira.call("GET", `${w}/billing`)).body;
  assert.equal(b.enabled, true);
  assert.equal(b.plan, "free");
  assert.equal(b.canManage, true);
  assert.deepEqual([b.usage.editors, b.usage.viewers, b.usage.designSystems, b.usage.directions, b.usage.publishedScreens], [2, 0, 1, 1, 10]);
  assert.equal(b.limits.fetches, LIMITS.free.fetches);

  // Team: no editor limit.
  await setPlan(worker, "harbourline", "team");
  assert.equal((await mira.call("POST", `${w}/invites`, { emails: ["c@x.test", "d@x.test"], role: "designer" })).status, 201);
  assert.equal((await mira.call("POST", `${w}/directions`, { name: "Two" })).status, 201);
});

test("accepting an editor invite is checked again, in case the plan changed", async () => {
  const worker = await startWorker({ BILLING: "on" });
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  await setPlan(worker, "harbourline", "team");
  const inv = await mira.call("POST", "/api/w/harbourline/invites", { emails: ["a@x.test", "b@x.test"], role: "designer" });
  const viewerInv = await mira.call("POST", "/api/w/harbourline/invites", { emails: ["v@x.test"], role: "viewer" });
  await setPlan(worker, "harbourline", "free");
  const a = await person(worker, "a@x.test");
  assert.equal((await a.call("POST", `/api/invites/${inv.body.invites[0].id}/accept`)).status, 200);
  const b = await person(worker, "b@x.test");
  const refused = await b.call("POST", `/api/invites/${inv.body.invites[1].id}/accept`);
  assert.equal(refused.status, 402);
  assert.equal(refused.body.limit, "editors");
  const v = await person(worker, "v@x.test");
  assert.equal((await v.call("POST", `/api/invites/${viewerInv.body.invites[0].id}/accept`)).status, 200);
  // An owner can take someone out, which frees the seat; the last owner stays.
  const members = (await mira.call("GET", "/api/w/harbourline")).body.members as { id: string; email: string }[];
  assert.equal((await mira.call("DELETE", `/api/w/harbourline/members/${members.find((m) => m.email === "a@x.test")!.id}`)).status, 200);
  assert.equal((await b.call("POST", `/api/invites/${inv.body.invites[1].id}/accept`)).status, 200);
  assert.equal((await mira.call("DELETE", `/api/w/harbourline/members/${members.find((m) => m.email === "mira@harbourline.test")!.id}`)).status, 409);
});

test("fetches by key are counted without D1, rolled up by the cron, and a week over quota locks editing but never fetching", async () => {
  const points: { indexes?: unknown[]; blobs?: unknown[] }[] = [];
  const worker = await startWorker({ BILLING: "on", FETCHES: { writeDataPoint: (p: { indexes?: unknown[]; blobs?: unknown[] }) => points.push(p) }, CF_ACCOUNT_ID: "acc", CF_ANALYTICS_TOKEN: "tok" });
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const w = "/api/w/harbourline";
  const id = (await row(worker, "harbourline"))!.id as string;
  assert.equal((await mira.call("POST", `${w}/screens`, { name: "Send" })).status, 201);
  assert.equal((await mira.call("POST", `${w}/screens/send/versions/1/publish`)).status, 200);
  const key = (await mira.call("POST", `${w}/api-keys`, { name: "web" })).body.key;
  const product = worker.client({ key });

  // A product's fetch is one data point; a person looking in Studio isn't a fetch.
  assert.equal((await product.call("GET", `${w}/screens/send`)).status, 200);
  assert.equal((await mira.call("GET", `${w}/screens/send`)).status, 200);
  assert.deepEqual(points, [{ indexes: [id], blobs: ["screen"], doubles: [1] }]);

  // The rollup asks Analytics Engine for this month and last, and writes totals.
  const asked: string[] = [];
  let count = 12_000;
  const ae = (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.cloudflare.com/client/v4/accounts/acc/analytics_engine/sql");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer tok");
    asked.push(String(init.body));
    return json({ data: [{ workspace: id, fetches: String(count) }, { workspace: "gone", fetches: 5 }] });
  };
  await withFetch(ae, () => worker.scheduled());
  assert.equal(asked.length, 2);
  assert.match(asked[1], /SUM\(_sample_interval\).*FROM polyxd_studio_fetches.*GROUP BY index1/);
  const since = (await row(worker, "harbourline"))!.over_quota_since as string;
  assert.ok(since, "over quota from this run");
  const billing = (await mira.call("GET", `${w}/billing`)).body;
  assert.equal(billing.usage.fetches, 12_000);
  assert.equal(billing.fetchesPercent, 120);
  assert.equal(billing.locked, false);

  // Within the grace period, editing works; a second run keeps the first date.
  assert.equal((await mira.call("POST", `${w}/screens`, { name: "Grace" })).status, 201);
  await withFetch(ae, () => worker.scheduled());
  assert.equal((await row(worker, "harbourline"))!.over_quota_since, since);

  // Eight days over: changes are refused with a 402; fetches and reads carry on; billing still opens.
  await worker.env.DB.prepare("UPDATE workspaces SET over_quota_since = ? WHERE id = ?").bind(new Date(Date.now() - 8 * 86400e3).toISOString(), id).run();
  const locked = await mira.call("POST", `${w}/screens`, { name: "Locked" });
  assert.equal(locked.status, 402);
  assert.equal(locked.body.code, "over_quota");
  assert.equal((await product.call("GET", `${w}/screens/send`)).status, 200);
  assert.equal((await mira.call("GET", `${w}/screens`)).status, 200);
  assert.equal((await mira.call("POST", `${w}/billing/checkout`, { plan: "pro", interval: "month" })).status, 503, "not locked, just not set up");
  assert.equal((await mira.call("GET", `${w}/billing`)).body.locked, true);

  // Under quota again (a new month, or an upgrade): the lock lifts.
  count = 900;
  await withFetch(ae, () => worker.scheduled());
  assert.equal((await row(worker, "harbourline"))!.over_quota_since, null);
  assert.equal((await mira.call("POST", `${w}/screens`, { name: "Unlocked" })).status, 201);
});

test("checkout: owners only, the plan's price, Team's seats, the founding coupon until it runs out", async () => {
  const worker = await startWorker(STRIPE);
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const w = "/api/w/harbourline";
  const sent: URLSearchParams[] = [];
  let couponLeft = true;
  const stripe = (url: string, init: RequestInit) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal((init.headers as Record<string, string>).authorization, "Bearer sk_test_fake");
    const p = new URLSearchParams(String(init.body));
    sent.push(p);
    if (p.get("discounts[0][coupon]") && !couponLeft) return json({ error: { message: "Coupon expired", code: "coupon_expired" } }, 400);
    return json({ id: "cs_1", url: "https://checkout.stripe.com/c/pay/cs_1" });
  };
  await withFetch(stripe, async () => {
    const r = await mira.call("POST", `${w}/billing/checkout`, { plan: "pro", interval: "year" });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.url, "https://checkout.stripe.com/c/pay/cs_1");
    const p = sent[0];
    assert.equal(p.get("mode"), "subscription");
    assert.equal(p.get("line_items[0][price]"), "price_pro_year");
    assert.equal(p.get("line_items[0][quantity]"), "1");
    assert.equal(p.get("discounts[0][coupon]"), "FOUNDING");
    assert.equal(p.get("customer_email"), "mira@harbourline.test");
    const id = (await row(worker, "harbourline"))!.id;
    assert.equal(p.get("client_reference_id"), id);
    assert.equal(p.get("subscription_data[metadata][workspace_id]"), id);
    assert.equal(p.get("success_url"), "http://localhost:8789/w/harbourline/billing?upgraded=1");

    // Two editors: Pro is for one, Team bills both.
    const leo = await join(worker, mira, "harbourline", "leo@harbourline.test", "designer");
    assert.equal(leo.status, 200);
    assert.equal((await mira.call("POST", `${w}/billing/checkout`, { plan: "pro", interval: "month" })).status, 409);
    couponLeft = false;
    const team = await mira.call("POST", `${w}/billing/checkout`, { plan: "team", interval: "month" });
    assert.equal(team.status, 200);
    const [withCoupon, without] = sent.slice(-2);
    assert.equal(withCoupon.get("discounts[0][coupon]"), "FOUNDING");
    assert.equal(without.get("discounts[0][coupon]"), null, "retried at full price");
    assert.equal(without.get("allow_promotion_codes"), "true");
    assert.equal(without.get("line_items[0][price]"), "price_team_month");
    assert.equal(without.get("line_items[0][quantity]"), "2");

    // Only an owner pays; nonsense is refused before Stripe is asked.
    const count = sent.length;
    assert.equal((await leo.as.call("POST", `${w}/billing/checkout`, { plan: "team", interval: "month" })).status, 403);
    assert.equal((await leo.as.call("POST", `${w}/billing/portal`)).status, 403);
    assert.equal((await leo.as.call("GET", `${w}/billing`)).body.canManage, false);
    assert.equal(sent.length, count);
    assert.equal((await mira.call("POST", `${w}/billing/checkout`, { plan: "enterprise", interval: "month" })).status, 400);
    assert.equal((await mira.call("POST", `${w}/billing/portal`)).status, 409, "no customer yet");
  });
});

test("the webhook: signature checked, plan set from the subscription, seats synced, back to Free when it ends", async () => {
  const worker = await startWorker(STRIPE);
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const id = (await row(worker, "harbourline"))!.id as string;
  const hook = worker.client();
  const send = async (event: unknown, secret = STRIPE.STRIPE_WEBHOOK_SECRET) => {
    const payload = JSON.stringify(event);
    const res = await worker.app.request("http://localhost:8789/api/billing/webhook", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": await signPayload(payload, secret) }, body: payload }, worker.env);
    return res.status;
  };
  const end = Math.floor(Date.now() / 1000) + 30 * 86400;
  const sub = (price: string, quantity: number, status = "active") => ({ id: "sub_1", customer: "cus_1", status, metadata: { workspace_id: id }, items: { data: [{ id: "si_1", quantity, current_period_end: end, price: { id: price } }] } });

  // A request Stripe didn't sign is refused.
  assert.equal(await send({ type: "customer.subscription.updated", data: { object: sub("price_team_month", 9) } }, "whsec_wrong"), 400);
  assert.equal((await hook.call("POST", "/api/billing/webhook", { type: "x" })).status, 400);
  assert.equal((await row(worker, "harbourline"))!.plan, "free");

  // Checkout finished: Studio reads the subscription and sets the plan.
  const stripeCalls: { url: string; body: string }[] = [];
  let quantity = 1;
  await withFetch((url, init) => {
    stripeCalls.push({ url, body: String(init.body ?? "") });
    if (url === "https://api.stripe.com/v1/subscriptions/sub_1") return json(sub("price_team_month", quantity));
    if (url === "https://api.stripe.com/v1/subscription_items/si_1") return json({ id: "si_1" });
    return json({ error: { message: "unexpected" } }, 500);
  }, async () => {
    assert.equal(await send({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: id, customer: "cus_1", subscription: "sub_1" } } }), 200);
    let w = (await row(worker, "harbourline"))!;
    assert.deepEqual([w.plan, w.plan_status, w.billing_interval, w.seats, w.stripe_customer_id, w.stripe_subscription_id], ["team", "active", "month", 1, "cus_1", "sub_1"]);
    assert.equal(w.period_end, new Date(end * 1000).toISOString());
    const billing = (await mira.call("GET", "/api/w/harbourline/billing")).body;
    assert.equal(billing.plan, "team");
    assert.equal(billing.subscribed, true);

    // A new editor joins: the subscription's quantity follows, prorated. A viewer doesn't count.
    assert.equal((await join(worker, mira, "harbourline", "leo@harbourline.test", "designer")).status, 200);
    const change = stripeCalls.find((c) => c.url.endsWith("/subscription_items/si_1"))!;
    assert.deepEqual(Object.fromEntries(new URLSearchParams(change.body)), { quantity: "2", proration_behavior: "create_prorations" });
    assert.equal((await row(worker, "harbourline"))!.seats, 2);
    quantity = 2;
    const before = stripeCalls.length;
    assert.equal((await join(worker, mira, "harbourline", "ana@harbourline.test", "viewer")).status, 200);
    assert.equal(stripeCalls.length, before, "no Stripe call for a viewer");

    // Checkout again while subscribed is refused; the portal opens.
    assert.equal((await mira.call("POST", "/api/w/harbourline/billing/checkout", { plan: "team", interval: "year" })).status, 409);
    w = (await row(worker, "harbourline"))!;
    assert.equal(w.plan, "team");
  });

  // Changed in the portal to Pro yearly.
  assert.equal(await send({ type: "customer.subscription.updated", data: { object: sub("price_pro_year", 1) } }), 200);
  let w = (await row(worker, "harbourline"))!;
  assert.deepEqual([w.plan, w.billing_interval], ["pro", "year"]);

  // A failed payment shows at once; Stripe keeps retrying, so the plan stays.
  assert.equal(await send({ type: "invoice.payment_failed", data: { object: { customer: "cus_1" } } }), 200);
  w = (await row(worker, "harbourline"))!;
  assert.deepEqual([w.plan, w.plan_status], ["pro", "past_due"]);

  // A price no STRIPE_PRICE_* names changes nothing.
  assert.equal(await send({ type: "customer.subscription.updated", data: { object: sub("price_other", 1) } }), 200);
  assert.equal((await row(worker, "harbourline"))!.plan, "pro");

  // Cancelled: back to Free, the customer kept for next time.
  assert.equal(await send({ type: "customer.subscription.deleted", data: { object: sub("price_pro_year", 1, "canceled") } }), 200);
  w = (await row(worker, "harbourline"))!;
  assert.deepEqual([w.plan, w.plan_status, w.stripe_subscription_id, w.stripe_customer_id, w.period_end], ["free", "canceled", null, "cus_1", null]);

  // The portal, for a workspace with a customer.
  await withFetch((url, init) => {
    assert.equal(url, "https://api.stripe.com/v1/billing_portal/sessions");
    const p = new URLSearchParams(String(init.body));
    assert.equal(p.get("customer"), "cus_1");
    assert.equal(p.get("return_url"), "http://localhost:8789/w/harbourline/billing");
    return json({ url: "https://billing.stripe.com/p/session/1" });
  }, async () => {
    const r = await mira.call("POST", "/api/w/harbourline/billing/portal");
    assert.equal(r.status, 200);
    assert.equal(r.body.url, "https://billing.stripe.com/p/session/1");
  });
});

test("Stripe's signature and form encoding", async () => {
  const payload = '{"id":"evt_1"}';
  const t = 1_800_000_000;
  const header = await signPayload(payload, "whsec_x", t);
  assert.equal(await verifySignature(payload, header, "whsec_x", 300, t + 10), true);
  assert.equal(await verifySignature(payload, header, "whsec_x", 300, t + 301), false, "too old");
  assert.equal(await verifySignature(payload + " ", header, "whsec_x", 300, t), false, "body changed");
  assert.equal(await verifySignature(payload, header, "whsec_y", 300, t), false, "another secret");
  assert.equal(await verifySignature(payload, `t=${t},v1=00,${header.split(",")[1]}`, "whsec_x", 300, t), true, "any v1 may match");
  assert.equal(await verifySignature(payload, undefined, "whsec_x"), false);
  assert.equal(
    decodeURIComponent(form({ mode: "subscription", line_items: [{ price: "p", quantity: 2 }], metadata: { workspace_id: "w" }, skip: undefined }).toString()),
    "mode=subscription&line_items[0][price]=p&line_items[0][quantity]=2&metadata[workspace_id]=w",
  );
});

test("a refusal from Stripe says what Stripe said, so a mode mismatch isn't an opaque 500", async () => {
  const worker = await startWorker(STRIPE);
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const real = globalThis.fetch;
  // The shape of a live key asked for a test price: Stripe answers 400 resource_missing.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith("https://api.stripe.com")) return real(input as RequestInfo, init);
    return new Response(JSON.stringify({ error: { message: "No such price: 'price_pro_month'", code: "resource_missing", param: "line_items[0][price]" } }), { status: 400, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = await mira.call("POST", "/api/w/harbourline/billing/checkout", { plan: "pro", interval: "month" });
    assert.equal(r.status, 400, "a refusal, not a 500");
    assert.match(r.body.error, /No such price/);
    assert.equal(r.body.code, "resource_missing");
    assert.equal(r.body.param, "line_items[0][price]");
  } finally {
    globalThis.fetch = real;
  }
});

test("Stripe being down is a 502, not a refusal the owner could act on", async () => {
  const worker = await startWorker(STRIPE);
  const mira = await worker.signUp("mira@harbourline.test", "Harbourline");
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).startsWith("https://api.stripe.com")) return real(input as RequestInfo, init);
    return new Response(JSON.stringify({ error: { message: "Stripe is having a moment" } }), { status: 503, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const r = await mira.call("POST", "/api/w/harbourline/billing/checkout", { plan: "pro", interval: "month" });
    assert.equal(r.status, 502);
    assert.match(r.body.error, /didn't answer/);
  } finally {
    globalThis.fetch = real;
  }
});
