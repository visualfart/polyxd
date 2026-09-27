import type { IntentFile, ReportSummary } from "../kit/types.ts";

/**
 * Wexley's intents: each JSON file is one thing residents ask for, with its verified document and
 * the phrases that reach it. The data views live in views.ts so Node scripts can build the same data.
 */
type Raw = Omit<IntentFile, "slots"> & { slots?: Record<string, string> };

const files = import.meta.glob<{ default: Raw }>("./intents/*.json", { eager: true });
const reportFiles = import.meta.glob<{ default: ReportSummary }>("./reports/*.json", { eager: true });

export const INTENTS: IntentFile[] = Object.values(files)
  .map((m) => m.default)
  .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined }))
  .sort((a, b) => a.id.localeCompare(b.id));

/** Intents people can ask for by name; the confirmations only follow from another surface. */
export const ASKABLE = INTENTS.filter((i) => i.ask.length > 0);

export const REPORTS: Record<string, ReportSummary> = Object.fromEntries(Object.entries(reportFiles).map(([path, m]) => [path.replace(/.*\/(.+)\.json$/, "$1"), m.default]));

export const intentById = (id: string) => INTENTS.find((i) => i.id === id);

/** The id as a path segment: "permit.address-change" → "permit-address-change", so a dev server that maps dotted paths to files still serves the page. */
export const slug = (id: string) => id.replace(/\./g, "-");
export const intentBySlug = (s: string) => INTENTS.find((i) => slug(i.id) === s);

export { resolveSlots, surfaceData } from "./views.ts";
