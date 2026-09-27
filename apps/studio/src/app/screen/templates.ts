/**
 * Starting points for a new screen: the spec's example documents, each with a data snapshot, read
 * straight from the package so they never drift from what the spec ships.
 */
import type { Doc } from "../../screens/schema.ts";

const files = import.meta.glob("../../../../../packages/spec/examples/*.json", { eager: true, import: "default" }) as Record<string, Doc>;

export interface Template {
  id: string;
  title: string;
  intent: string;
  components: number;
  /** The root component, a fair one-word summary of the shape */
  shape: string;
  document: Doc;
}

export const TEMPLATES: Template[] = Object.entries(files)
  .map(([path, document]) => ({
    id: path.slice(path.lastIndexOf("/") + 1, -5),
    title: document.surface.title,
    intent: document.surface.intent ?? "",
    components: document.components.length,
    shape: document.components.find((c) => c.id === document.root)?.component ?? "",
    document,
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

/** A template's document as a fresh screen: its own copy, marked as authored, without the schema pointer. */
export function fromTemplate(t: Template, title: string, intent: string): Doc {
  const { $schema: _, ...doc } = structuredClone(t.document) as Doc & { $schema?: string };
  doc.surface = { ...doc.surface, title: title || doc.surface.title, ...(intent ? { intent } : {}), origin: "authored" };
  return doc;
}
