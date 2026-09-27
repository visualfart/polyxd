import { SKELETON_GROUP_CLASS, SKELETON_SHAPES, skeletonShape, skeletonStatus, type SkeletonPart, type SkeletonShape } from "@polyxd/core";
import { h, type VNode } from "./dom.ts";

export interface SkeletonProps {
  title?: string;
  pattern?: string;
  shape?: SkeletonShape;
  theme?: string;
  mode?: "light" | "dark";
  density?: "compact" | "comfortable" | "spacious";
  locale?: string;
  className?: string;
}

function Part(part: SkeletonPart): VNode {
  if ("block" in part) return h("span", { class: `pxd-skeleton-block pxd-skeleton-${part.block}${part.size ? ` pxd-skeleton-${part.size}` : ""}` });
  return h("div", { class: SKELETON_GROUP_CLASS[part.group] }, ...part.parts.map(Part));
}

/** The loading state for a surface that has not arrived yet: the shape it will take, shimmering. */
export function Skeleton({ title, pattern, shape, theme, mode, density, locale = "en-GB", className }: SkeletonProps): VNode {
  const chosen = skeletonShape(pattern, shape);
  return h(
    "div",
    { class: ["pxd-surface", "pxd-skeleton", `pxd-skeleton-${chosen}`, className].filter(Boolean).join(" "), "data-pxd-theme": theme, "data-pxd-mode": mode, "data-pxd-density": density, lang: locale, role: "status", "aria-busy": "true" },
    h("span", { class: "pxd-sr-only" }, skeletonStatus(title)),
    h("div", { class: "pxd-skeleton-body", "aria-hidden": "true" }, Part({ block: "title", size: chosen === "dialog" ? "short" : "medium" }), ...SKELETON_SHAPES[chosen].map(Part)),
  );
}
