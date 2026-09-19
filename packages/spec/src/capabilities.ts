import { childIds } from "./checks.ts";
import type { Issue } from "./validate.ts";

export type Risk = "none" | "low" | "consequential" | "destructive";

export interface Capability {
  description: string;
  risk: Risk;
  inputs?: { properties?: Record<string, unknown>; required?: string[] };
  flag?: string;
  agentMayInvoke?: boolean;
}

export interface CapabilityRegistry {
  name: string;
  capabilities: Record<string, Capability>;
}

/**
 * Checks a document's actions against the host's capability registry:
 * - every action names a registered capability that is switched on
 * - destructive capabilities are only triggered from a Confirm
 * - consequential capabilities are triggered from a Confirm, a review-and-submit surface,
 *   or the finish of Steps whose last step is a review (a DetailList)
 * - event context matches the capability's declared inputs
 */
export function checkCapabilities(doc: any, registry: CapabilityRegistry, flags: Record<string, boolean> = {}): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map<string, any>(doc.components.map((c: any) => [c.id, c]));
  const parent = new Map<string, string>();
  for (const c of doc.components) for (const r of childIds(c)) parent.set(r, c.id);
  const ancestors = (id: string) => {
    const out: any[] = [];
    for (let cur: string | undefined = id; cur; cur = parent.get(cur)) out.push(byId.get(cur));
    return out.filter(Boolean);
  };
  const lastStepIsReview = (steps: any) => {
    const last = steps.steps[steps.steps.length - 1]?.content;
    const seen = new Set<string>();
    const has = (id: string): boolean => {
      const c = byId.get(id);
      if (!c || seen.has(id)) return false;
      seen.add(id);
      return c.component === "DetailList" || childIds(c).some(has);
    };
    return has(last);
  };

  doc.components.forEach((c: any, index: number) => {
    const visit = (v: any, at: string, viaProp: string) => {
      if (!v || typeof v !== "object") return;
      if (v.event && typeof v.event.name === "string") {
        const name: string = v.event.name;
        if (name.startsWith("ui.")) return;
        const cap = registry.capabilities[name];
        const where = `${at}/event/name`;
        if (!cap) return void issues.push({ severity: "error", at: where, message: `"${name}" is not a registered capability` });
        if (cap.flag && flags[cap.flag] === false) issues.push({ severity: "error", at: where, message: `"${name}" is switched off by flag "${cap.flag}"` });

        const chain = ancestors(c.id);
        const inConfirm = chain.some((a) => a.component === "Confirm");
        const fromReviewedSteps = c.component === "Steps" && viaProp === "finish" && lastStepIsReview(c);
        const reviewSurface = doc.surface?.pattern === "review-and-submit";
        if (cap.risk === "destructive" && !inConfirm) {
          issues.push({ severity: "error", at: where, message: `"${name}" is destructive and must be triggered from a Confirm` });
        } else if (cap.risk === "consequential" && !(inConfirm || fromReviewedSteps || reviewSurface)) {
          issues.push({ severity: "error", at: where, message: `"${name}" is consequential and needs a Confirm or a review step before it` });
        }

        const declared = cap.inputs?.properties ? Object.keys(cap.inputs.properties) : [];
        const sent = Object.keys(v.event.context ?? {});
        for (const k of sent) if (!declared.includes(k)) issues.push({ severity: "warning", at: `${at}/event/context/${k}`, message: `"${name}" does not declare input "${k}"` });
        for (const k of cap.inputs?.required ?? []) if (!sent.includes(k)) issues.push({ severity: "warning", at: `${at}/event`, message: `"${name}" requires input "${k}"` });
        return;
      }
      for (const [k, x] of Object.entries(v)) visit(x, `${at}/${k}`, viaProp);
    };
    for (const [prop, value] of Object.entries(c)) visit(value, `/components/${index}/${prop}`, prop);
  });
  return issues;
}
