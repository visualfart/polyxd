import type { IntentFile, ReportSummary } from "../kit/types.ts";

/**
 * Halden's intents: each JSON file is one thing people ask for, with its verified document and the
 * phrases that reach it. The data views live in views.ts so Node scripts can build the same data.
 */
type Raw = Omit<IntentFile, "slots"> & { slots?: Record<string, string> };

const files = import.meta.glob<{ default: Raw }>("./intents/*.json", { eager: true });
const authoredFiles = import.meta.glob<{ default: Raw }>("./authored/*.json", { eager: true });
const reportFiles = import.meta.glob<{ default: ReportSummary }>("./reports/*.json", { eager: true });

const load = (modules: Record<string, { default: Raw }>): IntentFile[] =>
  Object.values(modules)
    .map((m) => m.default)
    .map((raw) => ({ ...raw, slots: raw.slots ? Object.fromEntries(Object.entries(raw.slots).map(([k, v]) => [k, new RegExp(v, "i")])) : undefined }))
    .sort((a, b) => a.id.localeCompare(b.id));

export const INTENTS: IntentFile[] = load(files);

/**
 * Screens of the product written as Polyxd documents by a person (authored/<id>.json): the same
 * shape as an intent, with no ask phrases, rendered inside the product's own shell. Verified the
 * same way as the generated ones; their reports live in reports/ beside the others.
 */
export const AUTHORED: IntentFile[] = load(authoredFiles);

/** Intents people can ask for by name; the confirmations only follow from another surface. */
export const ASKABLE = INTENTS.filter((i) => i.ask.length > 0);

export const REPORTS: Record<string, ReportSummary> = Object.fromEntries(Object.entries(reportFiles).map(([path, m]) => [path.replace(/.*\/(.+)\.json$/, "$1"), m.default]));

export const intentById = (id: string) => INTENTS.find((i) => i.id === id);

export { resolveSlots, surfaceData } from "./views.ts";
