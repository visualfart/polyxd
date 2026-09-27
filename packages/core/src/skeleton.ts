/** The loading state for a surface that has not arrived yet: the shape it will take. */

export type SkeletonShape = "list" | "form" | "detail" | "dashboard" | "dialog" | "compare";

export type BlockKind = "title" | "line" | "small" | "field" | "button" | "square" | "circle" | "badge" | "value" | "chart";
export type BlockSize = "short" | "medium" | "long" | "full";

/** One placeholder block, or a group of them: rows, stacked lines, an action row, a list of pairs, cards. */
export type SkeletonPart = { block: BlockKind; size?: BlockSize } | { group: "row" | "lines" | "actions" | "dl" | "cards" | "card"; parts: SkeletonPart[] };

/** What each pattern's surface usually looks like, so the placeholder has the right silhouette. */
export const PATTERN_SHAPE: Record<string, SkeletonShape> = {
  "multi-step-form": "form",
  "filter-and-browse": "list",
  "undo-over-confirm": "list",
  "compare-and-choose": "compare",
  "confirm-destructive": "dialog",
  "review-and-submit": "detail",
};

/** An explicit shape wins; a pattern picks one; otherwise a record page. */
export const skeletonShape = (pattern?: string, shape?: SkeletonShape): SkeletonShape => shape ?? (pattern ? PATTERN_SHAPE[pattern] : undefined) ?? "detail";

const block = (block: BlockKind, size?: BlockSize): SkeletonPart => ({ block, size });
const group = (kind: "row" | "lines" | "actions" | "dl" | "cards" | "card", parts: SkeletonPart[]): SkeletonPart => ({ group: kind, parts });
const times = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));

/** The silhouettes, as data, so every renderer draws the same one. */
export const SKELETON_SHAPES: Record<SkeletonShape, SkeletonPart[]> = {
  list: [block("field", "full"), ...times(5, (i) => group("row", [block("square"), group("lines", [block("line", i % 2 ? "medium" : "long"), block("small", "short")])]))],
  form: [...times(4, (i) => group("lines", [block("small", "short"), block("field", i === 1 ? "medium" : "long")])), group("actions", [block("button"), block("button")])],
  detail: [
    group("row", [block("circle"), group("lines", [group("row", [block("line", "medium"), block("badge")]), block("small", "short")])]),
    group("dl", times(6, (i) => group("row", [block("small", "short"), block("line", i % 3 === 2 ? "medium" : "long")]))),
  ],
  dashboard: [group("cards", times(3, () => group("card", [block("small", "short"), block("value", "medium")]))), block("chart", "full")],
  dialog: [block("line", "long"), block("line", "medium"), group("actions", [block("button"), block("button")])],
  compare: [group("cards", times(3, () => group("card", [block("line", "medium"), ...times(5, (i) => block("small", i % 2 ? "short" : "long"))])))],
};

/** The class each group takes, matching the stylesheet. */
export const SKELETON_GROUP_CLASS: Record<string, string> = { row: "pxd-skeleton-row", lines: "pxd-skeleton-lines", actions: "pxd-skeleton-actions", dl: "pxd-skeleton-dl", cards: "pxd-skeleton-cards", card: "pxd-skeleton-card" };

/** The status a skeleton announces. */
export const skeletonStatus = (title?: string): string => (title ? `Preparing ${title}` : "Preparing");
