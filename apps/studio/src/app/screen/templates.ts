/**
 * Starting points for a new screen: the spec's example documents, each with a data snapshot, read
 * straight from the package so they never drift from what the spec ships. The shell example is
 * kept apart: it is the one "Shell" start, trimmed to the product's own name.
 */
import { isShell, type Doc } from "../../screens/schema.ts";

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

const all: Template[] = Object.entries(files)
  .map(([path, document]) => ({
    id: path.slice(path.lastIndexOf("/") + 1, -5),
    title: document.surface.title,
    intent: document.surface.intent ?? "",
    components: document.components.length,
    shape: document.components.find((c) => c.id === document.root)?.component ?? "",
    document,
  }))
  .sort((a, b) => a.title.localeCompare(b.title));

/** The surface examples: everything but the shell. */
export const TEMPLATES: Template[] = all.filter((t) => !isShell(t.document));

/** The spec's shell example (shell-product.json): a Frame with a banner, an AppBar, a Navigation, an Outlet, an aside and a Footer. */
export const SHELL_TEMPLATE: Template | undefined = all.find((t) => isShell(t.document));

/** A template's document as a fresh screen: its own copy, marked as authored, without the schema pointer. */
export function fromTemplate(t: Template, title: string, intent: string): Doc {
  const { $schema: _, ...doc } = structuredClone(t.document) as Doc & { $schema?: string };
  doc.surface = { ...doc.surface, title: title || doc.surface.title, ...(intent ? { intent } : {}), origin: "authored" };
  return doc;
}

/**
 * The shell example as this product's shell: every mention of the example's product becomes the
 * product's name (the surface title, the AppBar's title, the logo's label and alt text, the legal
 * line), the sample data's notices go, and the id follows the name.
 */
export function shellFromTemplate(productName: string): Doc {
  if (!SHELL_TEMPLATE) throw new Error("The spec's shell example is missing");
  const name = productName.trim() || "Your product";
  const example = SHELL_TEMPLATE.document.surface.title;
  const swap = (v: unknown): unknown => {
    if (typeof v === "string") return v.split(example).join(name);
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, swap(x)]));
    return v;
  };
  const doc = swap(fromTemplate(SHELL_TEMPLATE, name, "product.shell")) as Doc;
  doc.surface.id = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}-shell`;
  // The example's maintenance banner and sailing times are Harbourline's; a new shell starts
  // without them (add a banner back from the Frame's slot when there is something to say).
  const frame = doc.components.find((c) => c.id === doc.root);
  if (frame) delete frame.banner;
  const aside = doc.components.find((c) => c.id === frame?.aside);
  if (aside && Array.isArray(aside.children)) aside.children = aside.children.filter((id: string) => id !== "sailing");
  doc.components = doc.components.filter((c) => c.id !== "banner" && c.id !== "sailing");
  const data = (doc.data ?? {}) as Record<string, unknown>;
  delete data.notice;
  delete data.nextSailing;
  data.legal = `© ${new Date().getFullYear()} ${name}`;
  data.release = "";
  doc.data = data;
  return doc;
}
