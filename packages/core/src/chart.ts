/** Chart geometry: the same numbers whichever renderer draws the SVG. */

export const CHART_W = 600;
export const CHART_H = 240;
export const CHART_PAD = { top: 16, right: 16, bottom: 32, left: 56 };
export const MARKERS = ["circle", "square", "diamond", "triangle", "circle", "square"] as const;

export const seriesColor = (i: number): string => `var(--pxd-color-data-categorical-${(i % 6) + 1})`;

export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Short axis labels: dates as "Apr" (or "3 Apr"), everything else as text. */
export function axisLabel(v: unknown, type: string | undefined, locale: string): string {
  if (type === "date" || type === "datetime") {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      const opts: Intl.DateTimeFormatOptions = d.getUTCDate() === 1 ? { month: "short", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" };
      return new Intl.DateTimeFormat(locale, opts).format(d);
    }
  }
  return String(v ?? "").slice(0, 12);
}

/**
 * How many points apart the x-axis labels go so they don't overlap: 1 when every label fits under
 * its band, otherwise the smallest step that leaves room for the widest label. Widths are estimated
 * at 7 units a character (the axis text is 12px), with 8 units between labels.
 */
export function axisLabelStep(labels: string[], plotW: number): number {
  if (labels.length < 2) return 1;
  const widest = Math.max(...labels.map((l) => l.length)) * 7 + 8;
  return Math.max(1, Math.ceil(widest / (plotW / labels.length)));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified treemap: tiles laid in rows along the shorter side, keeping them near square. */
export function treemap(values: number[], w: number, h: number): (Rect | null)[] {
  const total = values.reduce((a, v) => a + v, 0);
  const rects: (Rect | null)[] = values.map(() => null);
  if (total <= 0) return rects;
  const order = values.map((_, i) => i).filter((i) => values[i] > 0).sort((a, c) => values[c] - values[a]);
  const area = (i: number) => (values[i] / total) * w * h;
  let x = 0;
  let y = 0;
  let cw = w;
  let ch = h;
  let i = 0;
  while (i < order.length && cw > 0 && ch > 0) {
    const vertical = cw >= ch;
    const side = vertical ? ch : cw;
    let row: number[] = [];
    let rowArea = 0;
    let best = Infinity;
    while (i < order.length) {
      const trial = [...row, order[i]];
      const trialArea = rowArea + area(order[i]);
      const thickness = trialArea / side;
      const worst = Math.max(
        ...trial.map((j) => {
          const len = area(j) / thickness;
          return Math.max(len / thickness, thickness / len);
        }),
      );
      if (worst > best && row.length) break;
      row = trial;
      rowArea = trialArea;
      best = worst;
      i++;
    }
    const thickness = rowArea / side;
    let off = 0;
    for (const j of row) {
      const len = area(j) / thickness;
      rects[j] = vertical ? { x, y: y + off, w: thickness, h: len } : { x: x + off, y, w: len, h: thickness };
      off += len;
    }
    if (vertical) (x += thickness), (cw -= thickness);
    else (y += thickness), (ch -= thickness);
  }
  return rects;
}

/** The vertical scale of a bar or line chart: its floor, ceiling and three ticks. */
export function verticalScale(all: number[], trend: boolean): { lo: number; max: number; ticks: number[] } {
  const max = niceMax(Math.max(0, ...all));
  const min = trend ? Math.min(0, ...all) : 0;
  const trendMin = trend && all.length ? Math.max(min, Math.min(...all) - (Math.max(...all) - Math.min(...all)) * 0.2) : min;
  const lo = trend ? Math.floor(trendMin) : 0;
  return { lo, max, ticks: [0, 0.5, 1].map((t) => lo + (max - lo) * t) };
}

/** A marker's SVG: its element and attributes, by kind. */
export function markerShape(kind: string, x: number, y: number): { tag: "rect" | "path" | "circle"; attrs: Record<string, number | string> } {
  if (kind === "square") return { tag: "rect", attrs: { x: x - 4, y: y - 4, width: 8, height: 8 } };
  if (kind === "diamond") return { tag: "path", attrs: { d: `M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z` } };
  if (kind === "triangle") return { tag: "path", attrs: { d: `M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z` } };
  return { tag: "circle", attrs: { cx: x, cy: y, r: 4 } };
}

/** Stacked flows from each x value (left) into each series (right): where every band starts. */
export function flowLayout(values: number[][], seriesCount: number, h: number): { leftY: number[]; rightY: number[]; leftTotals: number[]; rightTotals: number[]; scale: number } {
  const leftTotals = values.map((row) => row.reduce((a, v) => a + v, 0));
  const rightTotals = Array.from({ length: seriesCount }, (_, si) => values.reduce((a, row) => a + row[si], 0));
  const total = leftTotals.reduce((a, v) => a + v, 0) || 1;
  const gap = 6;
  const usable = h - gap * (Math.max(values.length, seriesCount) - 1);
  const scale = usable / total;
  const leftY: number[] = [];
  const rightY: number[] = [];
  let yy = 0;
  leftTotals.forEach((t) => (leftY.push(yy), (yy += t * scale + gap)));
  yy = 0;
  rightTotals.forEach((t) => (rightY.push(yy), (yy += t * scale + gap)));
  return { leftY, rightY, leftTotals, rightTotals, scale };
}
