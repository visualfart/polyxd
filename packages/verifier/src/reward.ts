import type { Browser, Page } from "playwright";
import { renderPage, sentActions } from "./browser.ts";
import { verifyDocument, type VerifyOptions } from "./verify.ts";

/**
 * The training reward for one candidate surface (decision 0003).
 *
 * The verifier's score is the floor: valid, safe, accessible, laid out. On its own it rewards
 * timid interfaces — a summary with nothing to do scores well and does nothing (research log,
 * Phase 5 run 1). So the reward also asks whether the surface does the job: does it offer what the
 * request needed (coverage), and can an agent actually set it in motion?
 *
 * Coverage replaced a weaker question — "was any offered capability attached to anything" — after a
 * designer ranked the model's own output and the verifier disagreed with all of it. On "find 30
 * minutes with Tom and Priya", the candidate that attempted nothing scored highest and was ranked
 * last: a document that doesn't try can't make mistakes.
 */

/**
 * What the bench says a request needs. Every request in bench/requests*.json already declares it:
 * the capability the answer has to wire, the controls it has to offer by name, the components it
 * should be built from, and the pattern it should follow. `mustNot` is prose for a reader, so it
 * isn't read here.
 */
export interface RequestExpectation {
  pattern?: string;
  components?: string[];
  capability?: string;
  names?: string[];
}

export interface Reward {
  /** 0–100, the verifier's score */
  score: number;
  /** Offered capabilities attached to something operable, over offered */
  wiring: number;
  /** How much of the job the request asked for the document actually does, 0–1 */
  coverage: number;
  /** How closely it matches the components and pattern the bench expected, 0–1. Reported, not scored. */
  form: number;
  /** The parts of the request's expectation the document doesn't meet */
  missing: string[];
  /** Whether a scripted agent could trigger one of the offered capabilities */
  actionable: boolean;
  /** Components in the document, used for the length penalty */
  size: number;
  /** The combined reward, 0–100-ish */
  reward: number;
  findings: string[];
}

/** Every label in the document a person could read off a control. */
function labelsIn(flat: any): string[] {
  const out: string[] = [];
  const add = (v: unknown) => typeof v === "string" && out.push(v);
  for (const c of flat.components ?? []) {
    add(c.label);
    add(c.title);
    for (const p of ["submit", "confirm", "cancel", "choose", "clear", "finish", "action"]) add(c[p]?.label);
    for (const a of c.actions ?? []) add(a.label);
    for (const a of c.rowActions ?? []) add(a.label);
    for (const a of c.bulkActions ?? []) add(a.label);
  }
  return out;
}

/**
 * How much of what the request asked for the document actually offers.
 *
 * The verifier's score says whether a document is correct; it has no term for whether it does the
 * job. This is that term, and it needs no new annotation: the bench already declares, per request,
 * the capability the answer has to wire and the control it has to offer by name. A surface that
 * attempts nothing scores well and covers nothing.
 */
export function coverageOf(flat: any, expect?: RequestExpectation): { coverage: number; missing: string[] } {
  if (!expect) return { coverage: 1, missing: [] };
  const parts: number[] = [];
  const missing: string[] = [];

  if (expect.capability) {
    const wired = wiredCapabilities(flat).has(expect.capability);
    parts.push(wired ? 1 : 0);
    if (!wired) missing.push(`capability ${expect.capability}`);
  }
  if (expect.names?.length) {
    const labels = labelsIn(flat).map((l) => l.toLowerCase());
    const hit = expect.names.filter((n) => labels.some((l) => l.includes(n.toLowerCase())));
    parts.push(hit.length / expect.names.length);
    for (const n of expect.names) if (!hit.includes(n)) missing.push(`control "${n}"`);
  }
  if (expect.components?.length) {
    const present = new Set((flat.components ?? []).map((c: any) => c.component));
    const hit = expect.components.filter((c) => present.has(c));
    parts.push(hit.length / expect.components.length);
    for (const c of expect.components) if (!present.has(c)) missing.push(`component ${c}`);
  }
  if (expect.pattern) {
    const same = flat.surface?.pattern === expect.pattern;
    parts.push(same ? 1 : 0);
    if (!same) missing.push(`pattern ${expect.pattern}`);
  }
  return { coverage: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 1, missing };
}

/** Capabilities attached to a control a person or an agent can operate. */
export function wiredCapabilities(flat: any): Set<string> {
  const out = new Set<string>();
  const add = (a: any) => typeof a?.event?.name === "string" && out.add(a.event.name);
  for (const c of flat.components ?? []) {
    if (c.component === "Action" || c.component === "Card" || c.component === "Toggle") add(c.action);
    if (c.component === "Table") add(c.rowAction);
    if (Array.isArray(c.views)) for (const v of c.views) add(v.action);
    for (const p of ["submit", "confirm", "finish", "choose", "clear"]) add(c[p]?.action ?? c[p]);
    for (const b of c.breadcrumbs ?? []) add(b.action);
  }
  return out;
}

/**
 * Can an agent set the surface's main action in motion? Presses the most prominent action it can
 * find — the primary button, else the only button — and reports whether the host heard about it.
 * A surface nobody can act on is decoration, however well it scores.
 */
export async function probeActionable(page: Page, offered: string[]): Promise<boolean> {
  if (!offered.length) return true;
  await fillRequired(page);
  const before = (await sentActions(page)).length;
  const candidates = [
    page.locator(".pxd-surface .pxd-button-primary"),
    page.locator('.pxd-surface button[type="submit"]'),
    page.locator(".pxd-surface .pxd-card-link"),
    page.locator(".pxd-surface .pxd-button"),
  ];
  for (const locator of candidates) {
    if ((await locator.count()) === 0) continue;
    try {
      await locator.first().click({ timeout: 2000 });
    } catch {
      continue;
    }
    const sent = await sentActions(page);
    if (sent.length > before && sent.slice(before).some((a) => offered.includes(a.name))) return true;
  }
  return false;
}

/**
 * Fills what the surface insists on before pressing anything: an agent completing a task would,
 * and a form that can't be submitted empty isn't the same as a surface nobody can act on.
 */
async function fillRequired(page: Page): Promise<void> {
  const fields = page.locator(".pxd-surface input[required], .pxd-surface textarea[required]");
  for (let i = 0; i < (await fields.count()); i++) {
    const field = fields.nth(i);
    try {
      if (await field.inputValue()) continue;
      const type = await field.getAttribute("type");
      await field.fill(type === "number" ? "10" : type === "email" ? "someone@example.com" : type === "date" ? "2026-10-01" : "Test");
    } catch {
      // A control that can't be typed into (a radio, a checkbox) is handled below.
    }
  }
  for (const group of [".pxd-surface [role=radiogroup]", ".pxd-surface .pxd-people-list", ".pxd-surface .pxd-chips"]) {
    const first = page.locator(`${group} [role=radio], ${group} [role=checkbox]`).first();
    if ((await first.count()) && (await first.getAttribute("aria-checked")) !== "true") {
      await first.click({ timeout: 1500 }).catch(() => {});
    }
  }
}

/** Scores one candidate for training: the verifier, plus whether the surface can be used. */
export async function rewardFor(
  doc: any,
  browser: Browser,
  offered: string[],
  opts: VerifyOptions = {},
  medianSize = 0,
  expect?: RequestExpectation,
): Promise<Reward> {
  const report = await verifyDocument(doc, { browser, themes: ["material3"], modes: ["light"], widths: [390], ...opts });
  const wiredSet = wiredCapabilities(doc);
  const wiring = offered.length ? offered.filter((c) => wiredSet.has(c)).length / offered.length : 1;
  // What the request asked for, when the bench says; otherwise fall back to wiring, which asks the
  // weaker question of whether any offered capability was attached to anything.
  // Two different questions, kept apart. Coverage is *did it do the job* — the capability the
  // request needs, and a control named the way the task presses it. Form is *did it look the way
  // the bench expected* — components and pattern — and it is reported but not scored: a designer
  // ranking the model's own output was happy with surfaces the bench expected a Table from.
  const { coverage, missing } = expect ? coverageOf(doc, { capability: expect.capability, names: expect.names }) : { coverage: wiring, missing: [] };
  const form = expect ? coverageOf(doc, { components: expect.components, pattern: expect.pattern }).coverage : 1;

  let actionable = false;
  if (report.score > 0) {
    const { page } = await renderPage(browser, doc, { theme: "material3", mode: "light", width: 390 });
    try {
      actionable = await probeActionable(page, offered);
    } finally {
      await page.close();
    }
  }

  const size = doc.components?.length ?? 0;
  // There is no length penalty any more. It was there so padding a document to satisfy checks
  // wouldn't pay, but it pushed the same way as every other term: on "stop emailing me" the
  // designer ranked the four-toggle version first and the one-toggle version last, and the reward
  // was already biased towards the small one. `medianSize` is kept in the signature so callers
  // don't change; it is no longer read.
  const padding = 0;
  void medianSize;
  // Coverage multiplies rather than adds. A surface that doesn't do what was asked isn't a good
  // surface with a deduction; it isn't an answer, and adding a bonus for coverage leaves it ahead
  // of a surface that tried and made two mistakes — which is the ordering a designer ranked last.
  // The 0.2 floor keeps a partly-covering document from collapsing to nothing, because the bench's
  // expectations are themselves fallible.
  const reward = Math.max(0, report.score * (0.2 + 0.8 * coverage) + (actionable ? 20 : 0) - padding);
  return {
    score: report.score,
    wiring,
    coverage,
    form,
    missing,
    actionable,
    size,
    reward,
    findings: [...report.static, ...report.targets.flatMap((t) => t.findings)].filter((f) => f.severity === "error").map((f) => f.check),
  };
}
