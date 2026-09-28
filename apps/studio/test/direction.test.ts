/**
 * Design Directions: Studio's schema check agrees with ajv's, an exported Direction is valid and
 * survives import and export unchanged, the diff says what changed in the editor's words, and the
 * voice sample is judged by the spec's own checks.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { compileVoice as specCompileVoice } from "@polyxd/spec";
import { validateDirection, validatePattern } from "../src/direction/schema.ts";
import { blankDirection, blankPattern, fromImport, patternPath, rulesFromWorkspace, screenPath, toExport, toStored, type Direction, type Snapshot } from "../src/direction/model.ts";
import { diffDirections, summarise } from "../src/direction/diff.ts";
import { SAMPLE, avoidedIn, checkSample, compileVoice } from "../src/direction/voice.ts";

const spec = new URL("../../../packages/spec/", import.meta.url);
const json = (path: string | URL) => JSON.parse(readFileSync(path, "utf8"));
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
ajv.addSchema(json(new URL("schema/check.schema.json", spec)), "check.schema.json");
const ajvDirection = ajv.compile(json(new URL("schema/direction.schema.json", spec)));
const ajvPattern = ajv.compile(json(new URL("schema/pattern.schema.json", spec)));

const EXAMPLES: [string, URL][] = [
  ["calm-finance", new URL("examples/directions/calm-finance.json", spec)],
  ["playful-personal", new URL("examples/directions/playful-personal.json", spec)],
  ...["halden", "quay", "foundry", "wexley"].map((d) => [d, new URL(`../../apps/demos/${d}/direction.json`, spec)] as [string, URL]),
];
const halden = (): Direction => json(EXAMPLES[2][1]);
const WS_RULES = [
  { name: "Money only moves from a confirmation", severity: "error" as const, check: { check: "actionInside", capabilities: ["transfer.confirm"], container: ["Confirm"] }, enabled: 1, created_at: "2026-09-01T00:00:00Z" },
  { name: "Never ask “Are you sure”", severity: "warning" as const, check: { check: "noLabelMatches", pattern: "are you sure", flags: "i" }, enabled: 1, created_at: "2026-09-02T00:00:00Z" },
  { name: "Off for now", severity: "warning" as const, check: { check: "noEmoji" }, enabled: 0, created_at: "2026-09-03T00:00:00Z" },
];

test("Studio's schema check gives ajv's verdict on every example Direction", () => {
  for (const [name, path] of EXAMPLES) {
    const d = json(path);
    const theirs = ajvDirection(d);
    const ours = validateDirection(d);
    assert.equal(ours.length === 0, theirs, `${name}: ajv says ${JSON.stringify(ajvDirection.errors)}, Studio says ${JSON.stringify(ours)}`);
    // Where ajv refuses one, Studio points at the same field.
    for (const e of ajvDirection.errors ?? []) assert.ok(ours.some((p) => p.at === e.instancePath), `${name}: ${e.instancePath}`);
  }
  assert.deepEqual(validateDirection(json(EXAMPLES[0][1])), []);
  assert.deepEqual(validateDirection(blankDirection("acme")), []);
});

test("Studio's check refuses what ajv refuses, and says where in plain words", () => {
  const broken: [string, (d: any) => void, string, RegExp][] = [
    ["an unknown density", (d) => (d.profile.density = "cosy"), "/profile/density", /^Density must be one of “compact”, “comfortable”, “spacious”/],
    ["a budget of 4", (d) => (d.profile.emphasisBudget = 4), "/profile/emphasisBudget", /^Primary actions per view must be from 1 to 3/],
    ["a fractional budget", (d) => (d.profile.emphasisBudget = 1.5), "/profile/emphasisBudget", /whole number/],
    ["no version", (d) => delete d.version, "/version", /^Version is required/],
    ["no profile", (d) => delete d.profile, "/profile", /^Profile is required/],
    ["a key with capitals", (d) => (d.name = "Halden"), "/name", /^Key must be lower-case letters/],
    ["a setting that doesn't exist", (d) => (d.voice.shouting = true), "/voice/shouting", /isn't a setting Polyxd knows/],
    ["labels of 20 words", (d) => (d.voice.labels.maxWords = 20), "/voice/labels/maxWords", /^Longest button label must be from 1 to 12/],
    ["a glossary row without its word", (d) => (d.voice.glossary[1] = { insteadOf: ["x"] }), "/voice/glossary/1/use", /^Word 2: the word to use is required/],
    ["a rule with an unknown check", (d) => (d.rules[0].rule = { check: "looksNice" }), "/rules/0/rule/check", /^Rule 1 \(its check\) “looksNice” isn't a check Polyxd knows/],
    ["a rule check missing its terms", (d) => (d.rules[1].rule = { check: "avoidTerms" }), "/rules/1/rule/terms", /is required/],
    ["an empty list in a check", (d) => (d.rules[1].rule = { check: "avoidTerms", terms: [] }), "/rules/1/rule/terms", /needs at least one/],
    ["an exemplar without a request", (d) => (d.exemplars = [{ document: "../screens/send-money" }]), "/exemplars/0/request", /^Exemplar 1: the request it answers is required/],
    ["a reading grade of 30", (d) => (d.voice.readingLevel.maxGrade = 30), "/voice/readingLevel/maxGrade", /from 3 to 16/],
  ];
  for (const [what, breakIt, at, message] of broken) {
    const d = halden();
    breakIt(d);
    assert.equal(ajvDirection(d), false, `${what}: ajv should refuse it`);
    const problems = validateDirection(d);
    const hit = problems.find((p) => p.at === at);
    assert.ok(hit, `${what}: expected a problem at ${at}, got ${JSON.stringify(problems)}`);
    assert.match(hit.message, message, what);
  }
});

test("a team pattern is checked against the spec's pattern schema", () => {
  const p = blankPattern("Refund a payment", []);
  p.summary = "Show what comes back, to where, and when.";
  p.whenToUse = ["payments.refund"];
  p.structure = ["DetailList", "Confirm"];
  assert.ok(ajvPattern(p), JSON.stringify(ajvPattern.errors));
  assert.deepEqual(validatePattern(p), []);
  assert.equal(p.id, "refund-a-payment");
  assert.equal(blankPattern("Refund a payment", ["refund-a-payment"]).id, "refund-a-payment-2");
  assert.equal(blankPattern("2-step refund", []).id, "pattern-2-step-refund");
  const bad = { ...p, journey: { goal: "x" } };
  assert.equal(ajvPattern(bad), false);
  assert.ok(validatePattern(bad).some((x) => x.at === "/journey/checkpoints" && /Goal and done is required/.test(x.message)));
});

test("the workspace's rules become the Direction's: on ones only, oldest first, ids from their names", () => {
  const rules = rulesFromWorkspace([...WS_RULES].reverse());
  assert.deepEqual(rules.map((r) => r.id), ["money-only-moves-from-a-confirmation", "never-ask-are-you-sure"]);
  assert.equal(rules[0].description, "Money only moves from a confirmation");
  assert.deepEqual(rules[0].rule, WS_RULES[0].check);
  const twice = rulesFromWorkspace([WS_RULES[0], { ...WS_RULES[0], created_at: "2026-09-05T00:00:00Z" }, { ...WS_RULES[0], name: "42", created_at: "2026-09-06T00:00:00Z" }]);
  assert.deepEqual(twice.map((r) => r.id), ["money-only-moves-from-a-confirmation", "money-only-moves-from-a-confirmation-2", "rule-42"]);
});

test("an export is valid, names the Direction by its key, and lists the team's patterns and screens by path", () => {
  const p = blankPattern("Refund a payment", []);
  Object.assign(p, { summary: "Show what comes back and when.", whenToUse: ["payments.refund"], structure: ["DetailList", "Confirm"] });
  const d = halden();
  d.patterns = { prefer: ["confirm-destructive"], custom: ["../shared/lending.json"] };
  d.exemplars = [{ request: "send Alex the rent", document: screenPath("send-money") }];
  d.voice!.guidelines = ["  Plain and calm.  ", ""];
  const rules = rulesFromWorkspace(WS_RULES);
  const out = toExport({ direction: d, patterns: [p] }, "acme-bank", rules);
  assert.ok(ajvDirection(out), JSON.stringify(ajvDirection.errors));
  assert.deepEqual(validateDirection(out), []);
  assert.equal(out.name, "acme-bank");
  assert.deepEqual(Object.keys(out), ["$schema", "name", "version", "designSystem", "profile", "voice", "patterns", "rules", "exemplars"]);
  assert.deepEqual(out.patterns!.custom, ["../shared/lending.json", patternPath("acme-bank", "refund-a-payment")]);
  assert.equal(new URL(out.patterns!.custom![1], "https://studio.polyxd.com/api/w/acme/directions/acme-bank").pathname, "/api/w/acme/directions/acme-bank/patterns/refund-a-payment.json");
  assert.equal(new URL(out.exemplars![0].document, "https://studio.polyxd.com/api/w/acme/directions/acme-bank").pathname, "/api/w/acme/screens/send-money");
  assert.deepEqual(out.voice!.guidelines, ["Plain and calm."], "blank lines drop out, text is trimmed");
  assert.deepEqual(out.rules, rules, "the rules given replace the file's");
  // A blank Direction exports as a valid one too, without empty sections.
  const blank = toExport({ direction: blankDirection("acme"), patterns: [] }, "acme");
  assert.ok(ajvDirection(blank));
  assert.equal(blank.voice?.guidelines, undefined);
});

test("import then export gives back the same Direction", () => {
  for (const [name, path] of EXAMPLES) {
    const original = json(path);
    const rules = original.rules ?? [];
    const imported = fromImport(original, original.name, [], rules);
    assert.deepEqual(imported.newRules, [], `${name}: its rules are the workspace's already`);
    const out = toExport(imported.snapshot, original.name, rules);
    const { $schema: _a, ...a } = original;
    const { $schema: _b, ...b } = out;
    assert.deepEqual(b, a, name);
    // And through what a version stores.
    const again = toExport(toStored(imported.snapshot, original.name, rules), original.name);
    assert.deepEqual(again, out, `${name}: through storage`);
  }
});

test("an import keeps the team's own patterns it still lists, keeps other paths as paths, and hands back rules the workspace lacks", () => {
  const mine = blankPattern("Refund a payment", []);
  const other = blankPattern("Old one", []);
  const file = { ...halden(), patterns: { prefer: ["review-and-submit"], custom: [patternPath("halden", mine.id), "vendor/patterns/kyc.json"] } };
  const workspace = rulesFromWorkspace(WS_RULES);
  const r = fromImport(file, "halden", [mine, other], workspace);
  assert.deepEqual(r.snapshot.patterns.map((p) => p.id), [mine.id]);
  assert.deepEqual(r.external, ["vendor/patterns/kyc.json"]);
  assert.deepEqual(r.snapshot.direction.patterns, { prefer: ["review-and-submit"], custom: ["vendor/patterns/kyc.json"] });
  // Halden's "money-only-from-confirm" is the workspace's rule under another id: not new. Its other rule is.
  assert.deepEqual(r.newRules.map((x) => x.id), ["amount-on-confirm"]);
  assert.throws(() => fromImport([], "x", [], []), /JSON object/);
  // Imported under another key, the file's name follows the key.
  assert.equal(fromImport(halden(), "quay-bank", [], []).snapshot.direction.name, "quay-bank");
});

test("the diff says what changed, field by field, in the editor's words", () => {
  const rules = rulesFromWorkspace(WS_RULES);
  const before: Snapshot = { direction: toStored({ direction: halden(), patterns: [] }, "halden", rules).direction, patterns: [] };
  const after: Snapshot = structuredClone(before);
  after.direction.version = "1.1.0";
  after.direction.profile.density = "compact";
  delete after.direction.profile.motion;
  after.direction.voice!.tone!.energy = "upbeat";
  after.direction.voice!.avoid = [...after.direction.voice!.avoid!.filter((w) => w !== "oops"), "kindly"];
  after.direction.voice!.glossary![0].insteadOf = ["transaction"];
  after.direction.voice!.situations!.loading = "Say what is happening.";
  after.direction.patterns = { prefer: ["confirm-destructive"] };
  after.direction.rules![1] = { ...after.direction.rules![1], severity: "error" };
  after.direction.exemplars = [{ request: "send Alex the rent", document: screenPath("send-money") }];
  const refund = { ...blankPattern("Refund a payment", []), structure: ["DetailList", "Confirm"] };
  after.patterns = [refund];
  const changes = diffDirections(before, after);
  const line = (c: (typeof changes)[number]) => `${c.section} | ${c.what} | ${c.kind}${c.before !== undefined ? ` | ${c.before}` : ""}${c.after !== undefined ? ` → ${c.after}` : ""}`;
  assert.deepEqual(changes.map(line), [
    "Details | Version | changed | 1.0.0 → 1.1.0",
    "Profile | Density | changed | Comfortable → Compact",
    "Profile | Motion | removed | Subtle → Not set",
    "Voice | Tone: Energy | changed | Calm → Upbeat",
    "Voice | Say “payment” instead of | changed | transaction, txn → transaction",
    "Voice | Words to avoid | added → “kindly”",
    "Voice | Words to avoid | removed | “oops”",
    "Voice | Situation: Waiting | added | Not set → Say what is happening.",
    "Patterns | Preferred | added → Confirm a consequential or destructive action",
    "Patterns | Your pattern “Refund a payment” | added",
    "Rules | Rule “Never ask “Are you sure””: severity | changed | warning → error",
    "Exemplars | Exemplar: screen send-money, for “send Alex the rent” | added",
  ]);
  assert.equal(summarise(changes), "12 changes: 1 to the details, 2 to the profile, 5 to the voice, 2 to patterns, 1 to rules, 1 to exemplars");
  assert.deepEqual(diffDirections(before, structuredClone(before)), []);
  assert.equal(summarise([]), "No changes");
  // Against nothing published, everything set is new.
  const first = diffDirections(null, before);
  assert.ok(first.every((c) => c.kind === "added"));
  assert.ok(first.some((c) => c.what === "Density" && c.after === "Comfortable"));
  // A reordered list is reported, not missed.
  const reordered = structuredClone(before);
  reordered.direction.voice!.avoid = [...before.direction.voice!.avoid!].reverse();
  assert.deepEqual(diffDirections(before, reordered).map(line), ["Voice | Words to avoid | changed | In the old order → Reordered"]);
});

test("Studio's compileVoice is the spec's", () => {
  for (const [name, path] of EXAMPLES) assert.deepEqual(compileVoice(json(path)), specCompileVoice(json(path)), name);
});

test("the voice sample is judged by the verifier's copy checks", () => {
  const results = checkSample(halden(), SAMPLE);
  const failed = results.filter((r) => !r.pass).map((r) => r.id).sort();
  assert.deepEqual(failed, ["voice-avoid", "voice-casing", "voice-glossary-payment", "voice-label-length", "voice-no-exclamation", "voice-person"]);
  assert.match(results.find((r) => r.id === "voice-avoid")!.message, /Text: "simply"/);
  assert.match(results.find((r) => r.id === "voice-glossary-payment")!.message, /say "payment"/);
  assert.match(results.find((r) => r.id === "voice-casing")!.message, /Heading: "Payment Sent Successfully"/);
  // Too little text to measure a reading grade: it passes and says so.
  assert.match(results.find((r) => r.id === "voice-reading-level")!.message, /too little running text/);
  // A sample written to the voice passes everything.
  const good = checkSample(halden(), { heading: "Payment sent", text: "Your payment to Alex is on its way. It arrives by 5pm today.", button: "Send another" });
  assert.deepEqual(good.filter((r) => !r.pass), []);
  // American spelling is flagged under en-GB.
  const us = checkSample(halden(), { heading: "", text: "Pick a color.", button: "Save" });
  assert.match(us.find((r) => r.id === "voice-spelling")!.message, /"color" → "colour"/);
  assert.deepEqual(avoidedIn(halden(), SAMPLE.text).map((a) => a.term).sort(), ["oops", "simply", "transaction"]);
});
