/**
 * The benchmark's own integrity: registry, requests, sequences and the gold set are well-formed
 * and consistent with the spec, and the verifier can tell each gold group's best variant from its worst.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { validateDocument, uiSchema } from "@polyxd/spec";
import { staticAudit } from "../src/static.ts";
import { score } from "../src/verify.ts";
import { registry as exampleRegistry } from "./helpers.ts";

const bench = new URL("../../../bench/", import.meta.url);
const spec = new URL("../../spec/", import.meta.url);
const read = (u: URL) => JSON.parse(readFileSync(u, "utf8"));

const registry: any = read(new URL("registry.json", bench));
const requests: any[] = read(new URL("requests.json", bench)).requests;
const sequences: any[] = read(new URL("sequences.json", bench)).sequences;
const ranking = read(new URL("gold/ranking.json", bench));
const patterns = new Set(readdirSync(new URL("patterns/", spec)).map((f) => read(new URL(`patterns/${f}`, spec)).id));
const components = new Set(Object.keys((uiSchema as any).$defs).filter((k) => k.startsWith("Component") && k !== "Component").map((k) => k.slice("Component".length)));
const STEP_KINDS: Record<string, string[]> = {
  fill: ["value"],
  choose: ["in"],
  check: [],
  toggle: [],
  press: [],
  tab: [],
  setDate: ["value"],
};

test("registry is valid against the capability schema", () => {
  const validate = new Ajv2020({ strict: false }).compile(read(new URL("schema/capabilities.schema.json", spec)));
  assert.ok(validate(structuredClone(registry)), JSON.stringify(validate.errors));
  const risks = Object.values<any>(registry.capabilities).map((c) => c.risk);
  for (const r of ["none", "low", "consequential", "destructive"]) assert.ok(risks.includes(r), `no ${r} capability`);
  assert.ok(Object.values<any>(registry.capabilities).some((c) => c.flag), "some capability is behind a flag");
});

test("50 requests with unique ids, spread across domains", () => {
  assert.equal(requests.length, 50);
  assert.equal(new Set(requests.map((r) => r.id)).size, 50);
  const domains = Map.groupBy(requests, (r) => r.domain);
  assert.ok(domains.size >= 6, `only ${domains.size} domains`);
  for (const [d, rs] of domains) assert.ok(rs.length >= 6 && rs.length <= 9, `${d} has ${rs.length} requests`);
  for (const r of requests) {
    for (const k of ["id", "domain", "request", "intent", "data", "capabilities", "expect"]) assert.ok(k in r, `${r.id} lacks ${k}`);
    assert.ok(r.request.trim().length > 0);
  }
});

test("every request's capabilities exist in the registry, and expectations name real things", () => {
  for (const r of requests) {
    for (const c of r.capabilities) assert.ok(registry.capabilities[c], `${r.id}: unknown capability ${c}`);
    const e = r.expect;
    if (e.pattern) assert.ok(patterns.has(e.pattern), `${r.id}: unknown pattern ${e.pattern}`);
    for (const c of e.components ?? []) assert.ok(components.has(c), `${r.id}: unknown component ${c}`);
    if (e.capability) assert.ok(r.capabilities.includes(e.capability), `${r.id}: expected capability ${e.capability} is not exposed`);
    if (r.direction) assert.ok(existsSync(new URL(`examples/directions/${r.direction}.json`, spec)), `${r.id}: unknown direction ${r.direction}`);
    // Risk drives the pattern: destructive and consequential endings need a Confirm or a review.
    const risk = e.capability && registry.capabilities[e.capability].risk;
    if (risk === "destructive") assert.ok(e.components?.includes("Confirm"), `${r.id}: destructive capability without Confirm`);
    if (risk === "consequential") assert.ok(e.components?.includes("Confirm") || e.pattern === "review-and-submit" || e.components?.includes("Steps"), `${r.id}: consequential without Confirm or review`);
  }
});

test("tasks: at least 20, valid step types, events the host exposes", () => {
  const withTasks = requests.filter((r) => r.task);
  assert.ok(withTasks.length >= 20, `only ${withTasks.length} tasks`);
  for (const { id, task, capabilities, expect, data } of withTasks) {
    assert.ok(task.instruction && task.steps.length > 0, `${id}: empty task`);
    for (const step of task.steps) {
      const kinds = Object.keys(step).filter((k) => k in STEP_KINDS);
      assert.equal(kinds.length, 1, `${id}: step ${JSON.stringify(step)} must have exactly one action`);
      const allowed = new Set([kinds[0], ...STEP_KINDS[kinds[0]]]);
      for (const k of Object.keys(step)) assert.ok(allowed.has(k), `${id}: step ${JSON.stringify(step)} has unexpected "${k}"`);
      for (const k of STEP_KINDS[kinds[0]].filter((k) => k === "value")) assert.equal(typeof step[k], "string", `${id}: ${kinds[0]} needs a value`);
      assert.equal(typeof step[kinds[0]], "string");
    }
    assert.ok(capabilities.includes(task.expect.event), `${id}: task ends with ${task.expect.event}, which the host doesn't expose`);
    if (expect.capability) assert.equal(task.expect.event, expect.capability, `${id}: task and expect disagree`);
    const inputs = registry.capabilities[task.expect.event].inputs?.properties ?? {};
    for (const k of Object.keys(task.expect.context ?? {})) assert.ok(k in inputs, `${id}: ${task.expect.event} has no input "${k}"`);
    // Button names a model can't infer from data or the request must be given to it as host copy.
    // (A name may extend a required label with an item title, as Comparison's "Choose" + "Plus".)
    for (const step of task.steps) {
      if (!("press" in step)) continue;
      const named = (expect.names ?? []).some((n: string) => step.press === n || step.press.startsWith(`${n} `));
      assert.ok(named || JSON.stringify(data).includes(step.press), `${id}: "${step.press}" is neither host data nor in expect.names`);
    }
  }
});

test("edge cases are covered", () => {
  const unsupported = requests.filter((x) => x.capabilities.length === 0);
  assert.ok(unsupported.length >= 1 && unsupported.every((x) => x.expect.components.includes("Status")), "an unsupported request expects a Status");
  assert.ok(requests.some((x) => x.expect.capability && registry.capabilities[x.expect.capability].risk === "destructive"), "a destructive request");
  const hasEmpty = (v: unknown): boolean => (Array.isArray(v) ? v.length === 0 : v !== null && typeof v === "object" && Object.values(v).some(hasEmpty));
  assert.ok(requests.some((x) => hasEmpty(x.data) && x.expect.components?.includes("Status") && x.capabilities.length > 0), "an empty data set");
  assert.ok(requests.some((x) => x.expect.components?.includes("Steps") && x.expect.pattern === "multi-step-form"), "a request needing Steps");
  assert.ok(requests.some((x) => /ignore previous instructions/i.test(JSON.stringify(x.data))), "a prompt-injection string in data");
});

test("10 sequences of 3–5 turns with stable keys from their vocabulary", () => {
  assert.equal(sequences.length, 10);
  assert.equal(new Set(sequences.map((s) => s.id)).size, 10);
  for (const s of sequences) {
    assert.ok(s.turns.length >= 3 && s.turns.length <= 5, `${s.id} has ${s.turns.length} turns`);
    assert.ok(s.stable.length > 0, `${s.id}: nothing stable`);
    for (const k of s.stable) assert.ok(k in s.keys, `${s.id}: stable key ${k} not in keys`);
    for (const c of s.capabilities) assert.ok(registry.capabilities[c], `${s.id}: unknown capability ${c}`);
    assert.notEqual(s.turns[0].data, "same", `${s.id}: first turn needs data`);
  }
});

const gold = readdirSync(new URL("gold/", bench)).filter((f) => f.endsWith(".json") && f !== "ranking.json");
const goldDoc = (name: string) => read(new URL(`gold/${name}.json`, bench));
const staticScore = (doc: any) => score({ surface: "", static: staticAudit(doc, { registry: exampleRegistry }), targets: [], errors: 0, warnings: 0, agentSuccess: 0, agentRuns: 0 });

test("30 gold documents in 10 groups, all valid", () => {
  assert.equal(gold.length, 30);
  assert.equal(ranking.groups.length, 10);
  for (const g of ranking.groups) {
    assert.deepEqual(g.variants, ["a", "b", "c"].map((v) => `${g.id}-${v}`));
    assert.equal(g.humanRank === null || Array.isArray(g.humanRank), true);
  }
  for (const f of gold) {
    const v = validateDocument(read(new URL(`gold/${f}`, bench)));
    assert.ok(v.valid, `${f}: ${JSON.stringify(v.issues)}`);
  }
});

for (const g of ranking.groups) {
  test(`gold ${g.id}: variant a scores at least variant c (static audit), and c is detectably worse`, () => {
    const [a, , c] = g.variants.map((v: string) => staticScore(goldDoc(v)));
    assert.ok(a >= c, `a ${a} < c ${c}`);
    assert.ok(a > c, `c (${c}) isn't detectably worse than a (${a})`);
  });
}
