import type { Page } from "playwright";

export interface Finding {
  severity: "error" | "warning";
  check: string;
  message: string;
  /** How many elements are affected */
  count?: number;
}

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** axe-core WCAG 2.2 AA audit of the surface (including dialogs, which portal inside it). */
export async function axeAudit(page: Page): Promise<Finding[]> {
  const violations = await page.evaluate(async (tags) => {
    const axe = (window as any).axe;
    const result = await axe.run(document.querySelector(".pxd-surface"), { runOnly: { type: "tag", values: tags }, resultTypes: ["violations"] });
    return result.violations.map((v: any) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") }));
  }, WCAG_TAGS);
  return violations.map((v: any) => ({
    severity: v.impact === "critical" || v.impact === "serious" ? "error" : "warning",
    check: `axe:${v.id}`,
    message: `${v.help} (${v.count}× e.g. ${v.sample})`,
    count: v.count,
  }));
}

/**
 * Layout checks axe doesn't cover:
 * - no horizontal overflow at this width
 * - interactive targets meet WCAG 2.2 2.5.8 (24px, or 24px of clear spacing) and the pack's own minimum
 */
export async function layoutAudit(page: Page): Promise<Finding[]> {
  const r = await page.evaluate(() => {
    const surface = document.querySelector(".pxd-surface") as HTMLElement;
    const overflow = surface.scrollWidth - surface.clientWidth;
    const packMin = parseFloat(getComputedStyle(surface).getPropertyValue("--pxd-size-target-min")) || 24;
    const selector = "button, input:not([type=hidden]), textarea, select, a[href], [role=radio], [role=checkbox], [role=switch], [role=tab], [role=slider]";
    const els = [...surface.querySelectorAll<HTMLElement>(selector)].filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && !el.closest("[aria-hidden=true]");
    });
    // Radix renders a visually hidden native input next to its radios/checkboxes; skip those.
    const targets = els.filter((el) => !(el instanceof HTMLInputElement && el.getAttribute("aria-hidden") === "true"));
    // A stretched link (e.g. an actionable card) is as big as the element it covers.
    const rects = targets.map((el) => (el.closest(".pxd-card-actionable") && el.classList.contains("pxd-card-link") ? el.closest(".pxd-card-actionable")! : el).getBoundingClientRect());
    const name = (el: HTMLElement) => el.getAttribute("aria-label") || el.textContent?.trim().slice(0, 30) || el.id || el.tagName.toLowerCase();
    const tooSmall: string[] = [];
    const belowPack: string[] = [];
    targets.forEach((el, i) => {
      const { width, height } = rects[i];
      if (el.classList.contains("pxd-card-link")) return;
      const small = Math.min(width, height);
      // An element whose visible label is also clickable gets the label's area too.
      const label = el.id ? surface.querySelector<HTMLElement>(`label[for="${CSS.escape(el.id)}"]`) : null;
      const labelRect = label?.getBoundingClientRect();
      const effective = labelRect && labelRect.width > 0 ? Math.max(small, Math.min(labelRect.height, 1000)) : small;
      if (effective < 24) {
        // Spacing exception: a 24px circle centred on the target must not intersect another target.
        const cx = rects[i].x + width / 2;
        const cy = rects[i].y + height / 2;
        const crowded = rects.some((o, j) => {
          if (j === i) return false;
          const dx = Math.max(o.x - cx, 0, cx - (o.x + o.width));
          const dy = Math.max(o.y - cy, 0, cy - (o.y + o.height));
          return Math.hypot(dx, dy) < 12;
        });
        if (crowded) tooSmall.push(`${name(el)} (${Math.round(width)}×${Math.round(height)})`);
      } else if (effective < packMin - 0.5 && el.tagName === "BUTTON" && !el.closest("tr, .pxd-row-item, .pxd-breadcrumbs")) {
        // Rows and breadcrumb trails are dense by design: inside one, WCAG's 24px minimum applies,
        // not the pack's comfortable size — a 44px-tall breadcrumb is not what any of these systems draws.
        belowPack.push(`${name(el)} (${Math.round(width)}×${Math.round(height)})`);
      }
    });
    // What happens must be the last thing read before the button that does it.
    const consequence = surface.querySelector(".pxd-dialog-consequence");
    const bar = consequence?.closest(".pxd-dialog")?.querySelector(".pxd-action-bar");
    const consequenceMisplaced = !!consequence && !!bar && consequence.nextElementSibling !== bar;
    return { overflow, tooSmall, belowPack, packMin, consequenceMisplaced };
  });
  const out: Finding[] = [];
  if (r.consequenceMisplaced) out.push({ severity: "error", check: "layout:consequence-placement", message: "the consequence must sit directly above the buttons it warns about" });
  if (r.overflow > 1) out.push({ severity: "error", check: "layout:overflow", message: `content is ${r.overflow}px wider than the surface (horizontal scrolling)` });
  if (r.tooSmall.length) out.push({ severity: "error", check: "layout:target-size", message: `targets under 24px without spacing (WCAG 2.5.8): ${r.tooSmall.slice(0, 4).join(", ")}`, count: r.tooSmall.length });
  if (r.belowPack.length) out.push({ severity: "warning", check: "layout:target-size-pack", message: `buttons below the pack's ${r.packMin}px target: ${r.belowPack.slice(0, 4).join(", ")}`, count: r.belowPack.length });
  return out;
}
