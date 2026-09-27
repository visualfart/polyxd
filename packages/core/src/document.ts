/** The document a renderer walks, and what it sends back to the host. Framework-free. */

export type Node = Record<string, any> & { id: string; component: string };

/** A capability the document may trigger: `{ event: { name, context } }`. */
export interface Action {
  event: { name: string; context?: Record<string, unknown> };
}

export interface UIDocument {
  specVersion: string;
  surface: {
    id: string;
    title: string;
    intent?: string;
    pattern?: string;
    journey?: string;
    dismissible?: boolean;
    subtitle?: unknown;
    breadcrumbs?: { label: unknown; action?: any }[];
    badge?: { text: unknown; tone?: string };
    avatar?: unknown;
    /** ActionBar id: what you can do to this record */
    actions?: string;
    presentation?: "page" | "panel";
    origin?: "generated" | "authored";
    /** A shell is the product's frame (a Frame with an Outlet); a surface is a screen inside one. */
    kind?: "surface" | "shell";
  };
  root: string;
  components: Node[];
  data?: Record<string, unknown>;
}

export interface ActionEvent {
  /** Capability name, e.g. "transfer.confirm" */
  name: string;
  /** Resolved context values */
  context: Record<string, unknown>;
  /** Id of the component that triggered it */
  source: string;
}

export type NavigationPlacement = "side" | "rail" | "bar" | "drawer";

/** What a Frame decided for the width it has, so a host's own screens can adapt with it. */
export interface FrameLayout {
  navigation: NavigationPlacement;
  compact: boolean;
}

/** Actions the renderer handles itself; every other name reaches the host. */
export const RENDERER_ACTIONS = ["ui.dismiss", "ui.back", "ui.next", "ui.copy"] as const;

/** Every component the spec defines, in the registry's order: the shell's five come last. */
export const COMPONENTS = [
  "Section", "Group", "Card", "Disclosure", "Views", "Navigation",
  "Text", "Metric", "DetailList", "Collection", "Table", "Chart", "Media", "Status",
  "TextInput", "Choice", "Toggle", "DateInput", "RangeInput", "Form",
  "Action", "ActionBar", "Steps", "Confirm", "Comparison", "FilterPanel",
  "Tag", "Identity", "Progress", "Rating", "Code", "Tree", "ActionMenu", "Panel", "FileInput", "ColorInput", "CodeInput",
  "Columns", "Split",
  "Frame", "AppBar", "Footer", "Outlet", "Custom",
] as const;

/** Index of a document's components by id. */
export const indexById = (doc: UIDocument): Map<string, Node> => new Map(doc.components.map((c) => [c.id, c]));

/** A surface's main navigation, which sits outside the root and renders beside the page (a shell's is inside its Frame). */
export const mainNavigation = (doc: UIDocument): Node | undefined =>
  doc.surface.kind === "shell" ? undefined : doc.components.find((c) => c.component === "Navigation" && (!c.kind || c.kind === "main"));
