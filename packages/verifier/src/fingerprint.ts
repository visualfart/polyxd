import type { Page } from "playwright";

/**
 * What a rendered surface is, independent of who rendered it: the components in reading order,
 * the accessibility tree (roles, names, states, in order) and the visible text. Two renderers
 * are conformant when a document gives the same fingerprint in each, in every pack, mode and
 * width. This is stricter than consistency.ts's signature, which reads the document; this
 * reads the page.
 */
export interface Fingerprint {
  /** [component id, component name] for every element a component rendered, in DOM order */
  components: [string, string][];
  /** Playwright's ARIA snapshot of the surface: roles and accessible names in reading order */
  aria: string;
  /** The surface's visible text, whitespace collapsed */
  text: string;
}

export async function renderedFingerprint(page: Page): Promise<Fingerprint> {
  const surface = page.locator(".pxd-surface").first();
  const [components, text] = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".pxd-surface")!;
    const components = [...root.querySelectorAll<HTMLElement>("[data-pxd-id]")].map((el) => [el.dataset.pxdId!, el.dataset.pxdComponent ?? ""] as [string, string]);
    return [components, root.innerText.replace(/\s+/g, " ").trim()];
  });
  const aria = normaliseAria(await surface.ariaSnapshot());
  return { components, aria, text };
}

/** Generated ids differ per renderer (React's :r1:, the Web renderer's pxd-…); they name nothing a person sees. */
function normaliseAria(snapshot: string): string {
  return snapshot
    .split("\n")
    .map((l) => l.replace(/\s+$/, "").replace(/^(\s*- \/url: ")#[^"]*"$/, "$1#id\""))
    .join("\n");
}

/** The differences between two fingerprints, in words; empty when they match. */
export function compareFingerprints(a: Fingerprint, b: Fingerprint, aName = "react", bName = "web"): string[] {
  const out: string[] = [];
  if (a.components.length !== b.components.length || a.components.some(([id, c], i) => b.components[i]?.[0] !== id || b.components[i]?.[1] !== c)) {
    const first = a.components.findIndex(([id, c], i) => b.components[i]?.[0] !== id || b.components[i]?.[1] !== c);
    const at = first < 0 ? a.components.length : first;
    out.push(`components differ at #${at}: ${aName} ${JSON.stringify(a.components[at])} vs ${bName} ${JSON.stringify(b.components[at])} (${a.components.length} vs ${b.components.length})`);
  }
  if (a.aria !== b.aria) {
    const al = a.aria.split("\n");
    const bl = b.aria.split("\n");
    const i = al.findIndex((l, n) => bl[n] !== l);
    out.push(`aria differs at line ${i + 1}:\n      ${aName}: ${al[i] ?? "(end)"}\n      ${bName}: ${bl[i] ?? "(end)"}`);
  }
  if (a.text !== b.text) {
    let i = 0;
    while (i < a.text.length && a.text[i] === b.text[i]) i++;
    out.push(`text differs at ${i}: ${aName} "…${a.text.slice(Math.max(0, i - 30), i + 40)}" vs ${bName} "…${b.text.slice(Math.max(0, i - 30), i + 40)}"`);
  }
  return out;
}
