import type { Browser, Page } from "playwright";
import { renderPage, sentActions } from "./browser.ts";
import { verifyDocument, type VerifyOptions } from "./verify.ts";

/**
 * The training reward for one candidate surface (decision 0003).
 *
 * The verifier's score is the floor: valid, safe, accessible, laid out. On its own it rewards
 * timid interfaces — a summary with nothing to do scores well and does nothing (research log,
 * Phase 5 run 1). So the reward also asks whether the surface is *usable*: does it wire up the
 * capabilities the host offered, and can an agent actually set that in motion?
 */
export interface Reward {
  /** 0–100, the verifier's score */
  score: number;
  /** Offered capabilities attached to something operable, over offered */
  wiring: number;
  /** Whether a scripted agent could trigger one of the offered capabilities */
  actionable: boolean;
  /** Components in the document, used for the length penalty */
  size: number;
  /** The combined reward, 0–100-ish */
  reward: number;
  findings: string[];
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
export async function rewardFor(doc: any, browser: Browser, offered: string[], opts: VerifyOptions = {}, medianSize = 0): Promise<Reward> {
  const report = await verifyDocument(doc, { browser, themes: ["material3"], modes: ["light"], widths: [390], ...opts });
  const wiredSet = wiredCapabilities(doc);
  const wiring = offered.length ? offered.filter((c) => wiredSet.has(c)).length / offered.length : 1;

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
  // Padding a document to satisfy checks shouldn't pay: past the median size, each extra component costs a little.
  const padding = medianSize && size > medianSize ? Math.min(6, (size - medianSize) * 0.5) : 0;
  const reward = Math.max(0, report.score + 20 * wiring + (actionable ? 20 : 0) - padding);
  return {
    score: report.score,
    wiring,
    actionable,
    size,
    reward,
    findings: [...report.static, ...report.targets.flatMap((t) => t.findings)].filter((f) => f.severity === "error").map((f) => f.check),
  };
}
