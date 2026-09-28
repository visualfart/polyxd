import { useId, type ReactNode } from "react";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { asList, absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { useA11y } from "../surface.tsx";
import { CHART_H as H, CHART_PAD as PAD, CHART_W as W, MARKERS, axisLabel, axisLabelStep, flowLayout, niceMax, seriesColor, treemap, verticalScale } from "@polyxd/core";

function Marker({ kind, x, y, color }: { kind: string; x: number; y: number; color: string }) {
  if (kind === "square") return <rect x={x - 4} y={y - 4} width={8} height={8} fill={color} />;
  if (kind === "diamond") return <path d={`M${x} ${y - 5}L${x + 5} ${y}L${x} ${y + 5}L${x - 5} ${y}Z`} fill={color} />;
  if (kind === "triangle") return <path d={`M${x} ${y - 5}L${x + 5} ${y + 4}L${x - 5} ${y + 4}Z`} fill={color} />;
  return <circle cx={x} cy={y} r={4} fill={color} />;
}

/** Charts choose their form from intent; the summary and a data table are always present. */
export function Chart({ node }: { node: Node }) {
  const b = useBindings();
  const s = useSurface();
  const titleId = useId();
  const summaryId = useId();
  const pointer = absolute(node.data.path, b.scope);
  const points = asList(get(s.data, pointer)).map((_, i) => childPointer(pointer, i));
  const x = (p: string) => get(s.data, absolute(node.x.path, { pointer: p }));
  const y = (p: string, series: any) => Number(get(s.data, absolute(series.path, { pointer: p }))) || 0;
  const color = seriesColor;
  const series: any[] = node.series;
  const a11y = useA11y(node);
  const fmt = (v: unknown, format: any) => formatValue(v, resolveFormat(format, s.data, b.scope), s.locale);
  const xLabel = (p: string) => fmt(x(p), node.x.format);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  let body: React.ReactNode = null;

  /** Title and summary, the drawing, an optional legend, and the data table every chart carries. */
  const figure = (drawing: ReactNode, legend?: ReactNode) => (
    <figure className="pxd-chart" aria-labelledby={titleId} aria-describedby={summaryId} {...a11y}>
      <figcaption>
        <span className="pxd-chart-title" id={titleId}>{b.text(node.title)}</span>
        <span className="pxd-chart-summary" id={summaryId}>{b.text(node.summary)}</span>
      </figcaption>
      {drawing}
      {legend}
      <DataTable node={node} points={points} x={x} y={y} />
    </figure>
  );
  const seriesLegend = series.length > 1 && (
    <ul className="pxd-chart-legend">
      {series.map((sr, si) => (
        <li key={si}>
          <svg width="12" height="12" aria-hidden="true">
            <Marker kind={MARKERS[si]} x={6} y={6} color={color(si)} />
          </svg>
          {b.text(sr.label)}
        </li>
      ))}
    </ul>
  );

  if (node.intent === "relationship") {
    // Scatter: x is a measure too, each series a set of points with its own marker.
    const xs = points.map((p) => Number(x(p)) || 0);
    const ys = points.flatMap((p) => series.map((sr) => y(p, sr)));
    const xMax = niceMax(Math.max(0, ...xs));
    const yMax = niceMax(Math.max(0, ...ys));
    const sx = (v: number) => PAD.left + (v / (xMax || 1)) * plotW;
    const sy = (v: number) => PAD.top + plotH - (v / (yMax || 1)) * plotH;
    return figure(
      <svg viewBox={`0 0 ${W} ${H}`} className="pxd-chart-svg" aria-hidden="true">
        <g className="pxd-chart-axis">
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={sy(yMax * t)} y2={sy(yMax * t)} className="pxd-chart-grid" />
              <text x={PAD.left - 8} y={sy(yMax * t) + 4} textAnchor="end">
                {fmt(yMax * t, { ...(series[0].format ?? { type: "number" }), precision: 0 })}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((t) => (
            <text key={t} x={sx(xMax * t)} y={H - 10} textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}>
              {fmt(xMax * t, { ...(node.x.format ?? { type: "number" }), precision: 0 })}
            </text>
          ))}
        </g>
        {series.map((sr, si) => (
          <g key={si}>
            {points.map((p, i) => (
              <Marker key={i} kind={MARKERS[si]} x={sx(xs[i])} y={sy(y(p, sr))} color={color(si)} />
            ))}
          </g>
        ))}
      </svg>,
      seriesLegend,
    );
  }

  if (node.intent === "range") {
    // A bar per x value from the first series to the second.
    const rowH = 28;
    const h = PAD.top + points.length * rowH + 24;
    const lows = points.map((p) => y(p, series[0]));
    const highs = points.map((p) => y(p, series[1] ?? series[0]));
    const lo = Math.min(0, ...lows);
    const hi = niceMax(Math.max(...highs, 1));
    const left = 120;
    const sx = (v: number) => left + ((v - lo) / (hi - lo || 1)) * (W - left - PAD.right);
    return figure(
      <svg viewBox={`0 0 ${W} ${h}`} className="pxd-chart-svg" aria-hidden="true">
        <g className="pxd-chart-axis">
          {[0, 0.5, 1].map((t) => {
            const v = lo + (hi - lo) * t;
            return (
              <g key={t}>
                <line x1={sx(v)} x2={sx(v)} y1={PAD.top} y2={h - 20} className="pxd-chart-grid" />
                <text x={sx(v)} y={h - 4} textAnchor="middle">
                  {fmt(v, { ...(series[0].format ?? { type: "number" }), precision: 0 })}
                </text>
              </g>
            );
          })}
        </g>
        {points.map((p, i) => {
          const yy = PAD.top + i * rowH;
          return (
            <g key={p}>
              <text x={left - 8} y={yy + rowH / 2 + 4} textAnchor="end" className="pxd-chart-range-label">
                {axisLabel(x(p), node.x.format?.type, s.locale)}
              </text>
              <line x1={sx(lows[i])} x2={sx(highs[i])} y1={yy + rowH / 2} y2={yy + rowH / 2} stroke={color(0)} strokeWidth={10} strokeLinecap="round" />
              <circle cx={sx(lows[i])} cy={yy + rowH / 2} r={4} fill={color(1)} />
              <circle cx={sx(highs[i])} cy={yy + rowH / 2} r={4} fill={color(2)} />
            </g>
          );
        })}
      </svg>,
      <ul className="pxd-chart-legend">
        <li>
          <span className="pxd-chart-swatch" style={{ background: color(1) }} aria-hidden="true" />
          {b.text(series[0].label)}
        </li>
        {series[1] && (
          <li>
            <span className="pxd-chart-swatch" style={{ background: color(2) }} aria-hidden="true" />
            {b.text(series[1].label)}
          </li>
        )}
      </ul>,
    );
  }

  if (node.intent === "matrix") {
    // A heatmap: x values down, series across, one colour shaded by value, the value printed in each cell.
    const values = points.map((p) => series.map((sr) => y(p, sr)));
    const max = Math.max(1, ...values.flat());
    return figure(
      <div className="pxd-heatmap-scroll" aria-hidden="true">
        <table className="pxd-heatmap">
          <thead>
            <tr>
              <th />
              {series.map((sr, si) => (
                <th key={si} scope="col">
                  {b.text(sr.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={p}>
                <th scope="row">{xLabel(p)}</th>
                {series.map((sr, si) => {
                  const pct = Math.round((values[i][si] / max) * 100);
                  return (
                    <td key={si} className={`pxd-heatmap-cell${pct >= 60 ? " pxd-heatmap-strong" : ""}`} style={{ background: `color-mix(in srgb, var(--pxd-color-data-categorical-1) ${pct}%, var(--pxd-color-surface-subtle))` }}>
                      {fmt(values[i][si], sr.format)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  }

  if (node.intent === "hierarchy") {
    // A treemap of the first series: each x value a tile sized by its share.
    const values = points.map((p) => Math.max(0, y(p, series[0])));
    const rects = treemap(values, W, H);
    return figure(
      <svg viewBox={`0 0 ${W} ${H}`} className="pxd-chart-svg pxd-chart-treemap" aria-hidden="true">
        {rects.map((r, i) =>
          r ? (
            <g key={i}>
              <rect x={r.x + 1} y={r.y + 1} width={Math.max(r.w - 2, 0)} height={Math.max(r.h - 2, 0)} fill={color(i)} rx={2} />
              {r.w > 48 && r.h > 24 && (
                <text x={r.x + 8} y={r.y + 18} className="pxd-chart-tile-label">
                  {xLabel(points[i]).slice(0, Math.floor(r.w / 8))}
                </text>
              )}
            </g>
          ) : null,
        )}
      </svg>,
      <ul className="pxd-chart-legend">
        {points.map((p, i) => (
          <li key={p}>
            <span className="pxd-chart-swatch" style={{ background: color(i) }} aria-hidden="true" />
            {xLabel(p)}: {fmt(values[i], series[0].format)}
          </li>
        ))}
      </ul>,
    );
  }

  if (node.intent === "flow") {
    // Stacked flows from each x value (left) into each series (right), band widths by amount.
    const values = points.map((p) => series.map((sr) => Math.max(0, y(p, sr))));
    const { leftY, rightY, leftTotals, rightTotals, scale } = flowLayout(values, series.length, H);
    const nodeW = 12;
    const labelW = 110;
    const x0 = labelW;
    const x1 = W - labelW;
    const leftOff = [...leftY];
    const rightOff = [...rightY];
    const xm = (x0 + x1) / 2;
    return figure(
      <svg viewBox={`0 0 ${W} ${H}`} className="pxd-chart-svg pxd-chart-flow" aria-hidden="true">
        {values.map((row, i) =>
          row.map((v, si) => {
            if (v <= 0) return null;
            const hh = v * scale;
            const ya = leftOff[i];
            const yb = rightOff[si];
            leftOff[i] += hh;
            rightOff[si] += hh;
            const d = `M${x0 + nodeW} ${ya} C${xm} ${ya}, ${xm} ${yb}, ${x1 - nodeW} ${yb} L${x1 - nodeW} ${yb + hh} C${xm} ${yb + hh}, ${xm} ${ya + hh}, ${x0 + nodeW} ${ya + hh} Z`;
            return <path key={`${i}-${si}`} d={d} fill={color(si)} opacity={0.45} />;
          }),
        )}
        {points.map((p, i) => (
          <g key={p}>
            <rect x={x0} y={leftY[i]} width={nodeW} height={Math.max(leftTotals[i] * scale, 1)} fill="var(--pxd-color-border-strong)" />
            <text x={x0 - 8} y={leftY[i] + (leftTotals[i] * scale) / 2 + 4} textAnchor="end" className="pxd-chart-flow-label">
              {xLabel(p)}
            </text>
          </g>
        ))}
        {series.map((sr, si) => (
          <g key={si}>
            <rect x={x1 - nodeW} y={rightY[si]} width={nodeW} height={Math.max(rightTotals[si] * scale, 1)} fill={color(si)} />
            <text x={x1 + 8} y={rightY[si] + (rightTotals[si] * scale) / 2 + 4} className="pxd-chart-flow-label">
              {b.text(sr.label)}
            </text>
          </g>
        ))}
      </svg>,
      seriesLegend,
    );
  }

  if (node.intent === "composition") {
    const values = points.map((p) => y(p, series[0]));
    const total = values.reduce((a, v) => a + v, 0) || 1;
    let offset = 0;
    body = (
      <g>
        {values.map((v, i) => {
          const w = (v / total) * (W - 2);
          const el = <rect key={i} x={1 + offset} y={4} width={Math.max(w - 2, 0)} height={40} fill={color(i)} rx={2} />;
          offset += w;
          return el;
        })}
      </g>
    );
    const legend = points.map((p, i) => ({ label: formatValue(x(p), resolveFormat(node.x.format, s.data, b.scope), s.locale), value: values[i], color: color(i), share: values[i] / total }));
    return (
      <figure className="pxd-chart" aria-labelledby={titleId} aria-describedby={summaryId} {...a11y}>
        <figcaption>
          <span className="pxd-chart-title" id={titleId}>{b.text(node.title)}</span>
          <span className="pxd-chart-summary" id={summaryId}>{b.text(node.summary)}</span>
        </figcaption>
        <svg viewBox={`0 0 ${W} 48`} className="pxd-chart-svg pxd-chart-bar" aria-hidden="true" preserveAspectRatio="none">
          {body}
        </svg>
        <ul className="pxd-chart-legend">
          {legend.map((l) => (
            <li key={l.label}>
              <span className="pxd-chart-swatch" style={{ background: l.color }} aria-hidden="true" />
              {l.label}: {formatValue(l.value, resolveFormat(series[0].format, s.data, b.scope), s.locale)} ({formatValue(l.share, { type: "percent", precision: 0 }, s.locale)})
            </li>
          ))}
        </ul>
        <DataTable node={node} points={points} x={x} y={y} />
      </figure>
    );
  }

  const all = points.flatMap((p) => series.map((sr) => y(p, sr)));
  const { lo, max, ticks } = verticalScale(all, node.intent === "trend");
  const scaleY = (v: number) => PAD.top + plotH - ((v - lo) / (max - lo || 1)) * plotH;
  const band = plotW / Math.max(points.length, 1);
  const labels = points.map((p) => axisLabel(x(p), node.x.format?.type, s.locale));
  const step = axisLabelStep(labels, plotW);

  const axis = (
    <g className="pxd-chart-axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={W - PAD.right} y1={scaleY(t)} y2={scaleY(t)} className="pxd-chart-grid" />
          <text x={PAD.left - 8} y={scaleY(t) + 4} textAnchor="end">
            {formatValue(t, { ...(resolveFormat(series[0].format, s.data, b.scope) ?? { type: "number" }), precision: 0 }, s.locale)}
          </text>
        </g>
      ))}
      {labels.map((label, i) =>
        i % step ? null : (
          <text key={points[i]} x={PAD.left + band * i + band / 2} y={H - 10} textAnchor="middle">
            {label}
          </text>
        ),
      )}
    </g>
  );

  if (node.intent === "trend") {
    body = series.map((sr, si) => {
      const pts = points.map((p, i) => [PAD.left + band * i + band / 2, scaleY(y(p, sr))] as const);
      return (
        <g key={si}>
          <polyline points={pts.map(([a, c]) => `${a},${c}`).join(" ")} fill="none" stroke={color(si)} strokeWidth={2.5} />
          {pts.map(([a, c], i) => (
            <Marker key={i} kind={MARKERS[si]} x={a} y={c} color={color(si)} />
          ))}
        </g>
      );
    });
  } else {
    // Distribution is a histogram: adjacent bins touch. Comparison bars keep gaps between items.
    const histogram = node.intent === "distribution";
    const fill = histogram ? 1 : 0.7;
    const barW = (band * fill) / series.length;
    body = points.flatMap((p, i) =>
      series.map((sr, si) => {
        const v = y(p, sr);
        const top = scaleY(Math.max(v, 0));
        return <rect key={`${i}-${si}`} x={PAD.left + band * i + band * ((1 - fill) / 2) + barW * si} y={top} width={barW - (histogram ? 1 : 2)} height={Math.max(scaleY(0) - top, 1)} fill={color(si)} rx={histogram ? 0 : 2} />;
      }),
    );
  }

  return (
    <figure className="pxd-chart" aria-labelledby={titleId} aria-describedby={summaryId} {...a11y}>
      <figcaption>
        <span className="pxd-chart-title" id={titleId}>{b.text(node.title)}</span>
        <span className="pxd-chart-summary" id={summaryId}>{b.text(node.summary)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="pxd-chart-svg" aria-hidden="true">
        {axis}
        {body}
      </svg>
      {series.length > 1 && (
        <ul className="pxd-chart-legend">
          {series.map((sr, si) => (
            <li key={si}>
              <svg width="12" height="12" aria-hidden="true">
                <Marker kind={MARKERS[si]} x={6} y={6} color={color(si)} />
              </svg>
              {b.text(sr.label)}
            </li>
          ))}
        </ul>
      )}
      <DataTable node={node} points={points} x={x} y={y} />
    </figure>
  );
}

function DataTable({ node, points, x, y }: { node: Node; points: string[]; x: (p: string) => unknown; y: (p: string, s: any) => number }) {
  const b = useBindings();
  const s = useSurface();
  return (
    <details className="pxd-chart-data">
      <summary>Show data</summary>
      <table className="pxd-table">
        <thead>
          <tr>
            <th scope="col">{b.text(node.x.label)}</th>
            {node.series.map((sr: any, i: number) => (
              <th scope="col" key={i} className="pxd-num">
                {b.text(sr.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p}>
              <th scope="row">{formatValue(x(p), resolveFormat(node.x.format, s.data, b.scope), s.locale)}</th>
              {node.series.map((sr: any, i: number) => (
                <td key={i} className="pxd-num">
                  {formatValue(y(p, sr), resolveFormat(sr.format, s.data, b.scope), s.locale)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
