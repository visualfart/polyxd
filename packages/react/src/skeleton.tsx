import type { ReactNode } from "react";
import { SKELETON_GROUP_CLASS, SKELETON_SHAPES, skeletonShape, skeletonStatus, type SkeletonPart, type SkeletonShape } from "@polyxd/core";

export type { SkeletonShape };

export interface PolyxdSkeletonProps {
  /** Surface title if the host already knows it: the status reads "Preparing {title}". */
  title?: string;
  /** Spec pattern id (e.g. "filter-and-browse"); picks the shape unless `shape` is given. */
  pattern?: string;
  shape?: SkeletonShape;
  /** Same as PolyxdSurface, so the skeleton sits in the same themed box the surface will. */
  theme?: string;
  mode?: "light" | "dark";
  density?: "compact" | "comfortable" | "spacious";
  locale?: string;
  className?: string;
}

/** One placeholder block, or a group of them, from the silhouette core describes. */
function Part({ part }: { part: SkeletonPart }): ReactNode {
  if ("block" in part) return <span className={`pxd-skeleton-block pxd-skeleton-${part.block}${part.size ? ` pxd-skeleton-${part.size}` : ""}`} />;
  return (
    <div className={SKELETON_GROUP_CLASS[part.group]}>
      {part.parts.map((p, i) => (
        <Part key={i} part={p} />
      ))}
    </div>
  );
}

/** The loading state for a surface that has not arrived yet: the shape it will take, shimmering. */
export function PolyxdSkeleton({ title, pattern, shape, theme, mode, density, locale = "en-GB", className }: PolyxdSkeletonProps) {
  const chosen = skeletonShape(pattern, shape);
  return (
    <div
      className={["pxd-surface", "pxd-skeleton", `pxd-skeleton-${chosen}`, className].filter(Boolean).join(" ")}
      data-pxd-theme={theme}
      data-pxd-mode={mode}
      data-pxd-density={density}
      lang={locale}
      role="status"
      aria-busy="true"
    >
      <span className="pxd-sr-only">{skeletonStatus(title)}</span>
      <div className="pxd-skeleton-body" aria-hidden="true">
        <Part part={{ block: "title", size: chosen === "dialog" ? "short" : "medium" }} />
        {SKELETON_SHAPES[chosen].map((p, i) => (
          <Part key={i} part={p} />
        ))}
      </div>
    </div>
  );
}
