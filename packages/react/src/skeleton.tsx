import type { ReactNode } from "react";

export type SkeletonShape = "list" | "form" | "detail" | "dashboard" | "dialog" | "compare";

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

/** What each pattern's surface usually looks like, so the placeholder has the right silhouette. */
const PATTERN_SHAPE: Record<string, SkeletonShape> = {
  "multi-step-form": "form",
  "filter-and-browse": "list",
  "undo-over-confirm": "list",
  "compare-and-choose": "compare",
  "confirm-destructive": "dialog",
  "review-and-submit": "detail",
};

/** One placeholder block. `kind` sets its height and radius; `size` its width as a share of the row. */
function Block({ kind, size }: { kind: "title" | "line" | "small" | "field" | "button" | "square" | "circle" | "badge" | "value" | "chart"; size?: "short" | "medium" | "long" | "full" }) {
  return <span className={`pxd-skeleton-block pxd-skeleton-${kind}${size ? ` pxd-skeleton-${size}` : ""}`} />;
}

const Row = ({ children }: { children: ReactNode }) => <div className="pxd-skeleton-row">{children}</div>;
const times = (n: number, render: (i: number) => ReactNode) => Array.from({ length: n }, (_, i) => render(i));

const SHAPES: Record<SkeletonShape, () => ReactNode> = {
  list: () => (
    <>
      <Block kind="field" size="full" />
      {times(5, (i) => (
        <Row key={i}>
          <Block kind="square" />
          <div className="pxd-skeleton-lines">
            <Block kind="line" size={i % 2 ? "medium" : "long"} />
            <Block kind="small" size="short" />
          </div>
        </Row>
      ))}
    </>
  ),
  form: () => (
    <>
      {times(4, (i) => (
        <div key={i} className="pxd-skeleton-lines">
          <Block kind="small" size="short" />
          <Block kind="field" size={i === 1 ? "medium" : "long"} />
        </div>
      ))}
      <div className="pxd-skeleton-actions">
        <Block kind="button" />
        <Block kind="button" />
      </div>
    </>
  ),
  detail: () => (
    <>
      <Row>
        <Block kind="circle" />
        <div className="pxd-skeleton-lines">
          <Row>
            <Block kind="line" size="medium" />
            <Block kind="badge" />
          </Row>
          <Block kind="small" size="short" />
        </div>
      </Row>
      <div className="pxd-skeleton-dl">
        {times(6, (i) => (
          <Row key={i}>
            <Block kind="small" size="short" />
            <Block kind="line" size={i % 3 === 2 ? "medium" : "long"} />
          </Row>
        ))}
      </div>
    </>
  ),
  dashboard: () => (
    <>
      <div className="pxd-skeleton-cards">
        {times(3, (i) => (
          <div key={i} className="pxd-skeleton-card">
            <Block kind="small" size="short" />
            <Block kind="value" size="medium" />
          </div>
        ))}
      </div>
      <Block kind="chart" size="full" />
    </>
  ),
  dialog: () => (
    <>
      <Block kind="line" size="long" />
      <Block kind="line" size="medium" />
      <div className="pxd-skeleton-actions">
        <Block kind="button" />
        <Block kind="button" />
      </div>
    </>
  ),
  compare: () => (
    <div className="pxd-skeleton-cards">
      {times(3, (c) => (
        <div key={c} className="pxd-skeleton-card">
          <Block kind="line" size="medium" />
          {times(5, (i) => (
            <Block key={i} kind="small" size={i % 2 ? "short" : "long"} />
          ))}
        </div>
      ))}
    </div>
  ),
};

/** The loading state for a surface that has not arrived yet: the shape it will take, shimmering. */
export function PolyxdSkeleton({ title, pattern, shape, theme, mode, density, locale = "en-GB", className }: PolyxdSkeletonProps) {
  const chosen = shape ?? (pattern ? PATTERN_SHAPE[pattern] : undefined) ?? "detail";
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
      <span className="pxd-sr-only">{title ? `Preparing ${title}` : "Preparing"}</span>
      <div className="pxd-skeleton-body" aria-hidden="true">
        <Block kind="title" size={chosen === "dialog" ? "short" : "medium"} />
        {SHAPES[chosen]()}
      </div>
    </div>
  );
}
