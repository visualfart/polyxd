/**
 * Sign-ups closed: no new account by email, except for the listed, the super admins and anyone
 * with a pending invite; people who already have an account still sign in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { startWorker } from "./support/worker.ts";

const signUp = (worker: Awaited<ReturnType<typeof startWorker>>, email: string, password = `test-${crypto.randomUUID()}`) =>
  worker.client().call("POST", "/api/auth/sign-up/email", { name: email.split("@")[0], email, password });

test("with SIGNUPS closed, a stranger can't make an account and /api/me says so", async () => {
  const worker = await startWorker({ SIGNUPS: "closed" });
  const r = await signUp(worker, "stranger@northwind.io");
  assert.equal(r.status, 403);
  assert.match(r.body.message, /coming soon/);
  assert.equal(await worker.env.DB.prepare("SELECT COUNT(*) AS n FROM user").first("n"), 0);
  assert.equal((await worker.client().call("GET", "/api/me")).body.signIn.signups, false);
});

test("with SIGNUPS closed, the listed, super admins and invitees still get in, and existing people sign in", async () => {
  const worker = await startWorker({ SIGNUPS: "closed", SIGNUP_ALLOW: "Tester@Polyxd.com", SUPER_ADMINS: "boss@polyxd.com" });
  assert.equal((await signUp(worker, "tester@polyxd.com")).status, 200);
  const password = `test-${crypto.randomUUID()}`;
  assert.equal((await signUp(worker, "boss@polyxd.com", password)).status, 200);

  const boss = worker.client();
  assert.equal((await boss.call("POST", "/api/auth/sign-in/email", { email: "boss@polyxd.com", password })).status, 200);
  assert.equal((await boss.call("POST", "/api/workspaces", { name: "Acme", slug: "acme" })).status, 201);
  assert.equal((await boss.call("POST", "/api/w/acme/invites", { emails: ["new@acme.com"], role: "designer" })).status, 201);
  assert.equal((await signUp(worker, "new@acme.com")).status, 200);
  assert.equal((await signUp(worker, "uninvited@acme.com")).status, 403);
});

test("unset, as on a self-hosted Studio, anyone may sign up", async () => {
  const worker = await startWorker();
  assert.equal((await signUp(worker, "anyone@northwind.io")).status, 200);
  assert.equal((await worker.client().call("GET", "/api/me")).body.signIn.signups, true);
});
