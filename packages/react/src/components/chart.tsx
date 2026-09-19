import { useId } from "react";
import { resolveFormat, useBindings, useSurface, type Node } from "../context.tsx";
import { absolute, childPointer, get } from "../data.ts";
import { formatValue } from "../format.ts";
import { useA11y } from "../surface.tsx";

const W = 600;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
const MARKERS = ["circle", "square", "diamond", "triangle", "circle", "square"] as const;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / p) * p;
}

/** Short axis labels: dates as "Apr" (or "3 Apr"), everything else as text. */
function axisLabel(v: unknown, type: string | undefined, locale: string): string {
  if (type === "date" || type === "datetime") {
    const d = new Date(String(v));
    if (!Number.isNaN(d.getTime())) {
      const opts: Intl.DateTimeFormatOptions = d.getUTCDate() === 1 ? { month: "short", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" };
      return new Intl.DateTimeFormat(locale, opts).format(d);
    }
  }
  return String(v ?? "").slice(0, 12);
}

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
  const points = ((get(s.data, pointer) as unknown[]) ?? []).map((_, i) => childPointer(pointer, i));
  const x = (p: string) => get(s.data, absolute(node.x.path, { pointer: p }));
  const y = (p: string, series: any) => Number(get(s.data, absolute(series.path, { pointer: p }))) || 0;
  const color = (i: number) => `var(--pxd-color-data-categorical-${(i % 6) + 1})`;
  const series: any[] = node.series;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  let body: React.ReactNode = null;

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
      <figure className="pxd-chart" aria-labelledby={titleId} aria-describedby={summaryId} {...useA11y(node)}>
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
  const max = niceMax(Math.max(0, ...all));
  const min = node.intent === "trend" ? Math.min(0, ...all) : 0;
  const trendMin = node.intent === "trend" && all.length ? Math.max(min, Math.min(...all) - (Math.max(...all) - Math.min(...all)) * 0.2) : min;
  const lo = node.intent === "trend" ? Math.floor(trendMin) : 0;
  const scaleY = (v: number) => PAD.top + plotH - ((v - lo) / (max - lo || 1)) * plotH;
  const ticks = [0, 0.5, 1].map((t) => lo + (max - lo) * t);
  const band = plotW / Math.max(points.length, 1);

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
      {points.map((p, i) => (
        <text key={p} x={PAD.left + band * i + band / 2} y={H - 10} textAnchor="middle">
          {axisLabel(x(p), node.x.format?.type, s.locale)}
        </text>
      ))}
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
    <figure className="pxd-chart" aria-labelledby={titleId} aria-describedby={summaryId} {...useA11y(node)}>
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
