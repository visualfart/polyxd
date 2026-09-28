import { CHART_H as H, CHART_PAD as PAD, CHART_W as W, MARKERS, absolute, asList, axisLabel, axisLabelStep, childPointer, flowLayout, formatValue, get, markerShape, niceMax, resolveFormat, seriesColor as color, treemap, verticalScale, type Node } from "@polyxd/core";
import { h, type VChild, type VNode } from "../dom.ts";
import type { Ctx } from "../renderer.ts";

const Marker = (kind: string, x: number, y: number, fill: string): VNode => {
  const { tag, attrs } = markerShape(kind, x, y);
  return h(tag, { ...attrs, fill });
};

/** Charts choose their form from intent; the summary and a data table are always present. */
export function Chart(node: Node, ctx: Ctx): VNode {
  const b = ctx.b;
  const r = ctx.r;
  const titleId = ctx.id(node, "title");
  const summaryId = ctx.id(node, "summary");
  const pointer = absolute(node.data.path, b.scope);
  const points = asList(get(r.data, pointer)).map((_, i) => childPointer(pointer, i));
  const x = (p: string) => get(r.data, absolute(node.x.path, { pointer: p }));
  const y = (p: string, series: any) => Number(get(r.data, absolute(series.path, { pointer: p }))) || 0;
  const series: any[] = node.series;
  const a11y = ctx.a11y(node);
  const fmt = (v: unknown, format: any) => formatValue(v, resolveFormat(format, r.data, b.scope), r.locale);
  const xLabel = (p: string) => fmt(x(p), node.x.format);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const dataTable = () =>
    h(
      "details",
      { class: "pxd-chart-data" },
      h("summary", null, "Show data"),
      h(
        "table",
        { class: "pxd-table" },
        h("thead", null, h("tr", null, h("th", { scope: "col" }, b.text(node.x.label)), ...series.map((sr: any, i: number) => h("th", { scope: "col", key: i, class: "pxd-num" }, b.text(sr.label))))),
        h("tbody", null, ...points.map((p) => h("tr", { key: p }, h("th", { scope: "row" }, fmt(x(p), node.x.format)), ...series.map((sr: any, i: number) => h("td", { key: i, class: "pxd-num" }, fmt(y(p, sr), sr.format)))))),
      ),
    );
  /** Title and summary, the drawing, an optional legend, and the data table every chart carries. */
  const figure = (drawing: VChild, legend?: VChild) =>
    h("figure", { class: "pxd-chart", "aria-labelledby": titleId, "aria-describedby": summaryId, ...a11y }, h("figcaption", null, h("span", { class: "pxd-chart-title", id: titleId }, b.text(node.title)), h("span", { class: "pxd-chart-summary", id: summaryId }, b.text(node.summary))), drawing, legend, dataTable());
  const seriesLegend = series.length > 1 && h("ul", { class: "pxd-chart-legend" }, ...series.map((sr, si) => h("li", { key: si }, h("svg", { width: "12", height: "12", "aria-hidden": "true" }, Marker(MARKERS[si], 6, 6, color(si))), b.text(sr.label))));
  const svg = (viewBox: string, cls: string, ...children: VChild[]) => h("svg", { viewBox, class: cls, "aria-hidden": "true" }, ...children);

  if (node.intent === "relationship") {
    // Scatter: x is a measure too, each series a set of points with its own marker.
    const xs = points.map((p) => Number(x(p)) || 0);
    const ys = points.flatMap((p) => series.map((sr) => y(p, sr)));
    const xMax = niceMax(Math.max(0, ...xs));
    const yMax = niceMax(Math.max(0, ...ys));
    const sx = (v: number) => PAD.left + (v / (xMax || 1)) * plotW;
    const sy = (v: number) => PAD.top + plotH - (v / (yMax || 1)) * plotH;
    return figure(
      svg(
        `0 0 ${W} ${H}`,
        "pxd-chart-svg",
        h(
          "g",
          { class: "pxd-chart-axis" },
          ...[0, 0.5, 1].map((t) => h("g", { key: t }, h("line", { x1: PAD.left, x2: W - PAD.right, y1: sy(yMax * t), y2: sy(yMax * t), class: "pxd-chart-grid" }), h("text", { x: PAD.left - 8, y: sy(yMax * t) + 4, "text-anchor": "end" }, fmt(yMax * t, { ...(series[0].format ?? { type: "number" }), precision: 0 })))),
          ...[0, 0.5, 1].map((t) => h("text", { key: `x${t}`, x: sx(xMax * t), y: H - 10, "text-anchor": t === 0 ? "start" : t === 1 ? "end" : "middle" }, fmt(xMax * t, { ...(node.x.format ?? { type: "number" }), precision: 0 }))),
        ),
        ...series.map((sr, si) => h("g", { key: si }, ...points.map((p, i) => Marker(MARKERS[si], sx(xs[i]), sy(y(p, sr)), color(si))))),
      ),
      seriesLegend,
    );
  }

  if (node.intent === "range") {
    // A bar per x value from the first series to the second.
    const rowH = 28;
    const hh = PAD.top + points.length * rowH + 24;
    const lows = points.map((p) => y(p, series[0]));
    const highs = points.map((p) => y(p, series[1] ?? series[0]));
    const lo = Math.min(0, ...lows);
    const hi = niceMax(Math.max(...highs, 1));
    const left = 120;
    const sx = (v: number) => left + ((v - lo) / (hi - lo || 1)) * (W - left - PAD.right);
    return figure(
      svg(
        `0 0 ${W} ${hh}`,
        "pxd-chart-svg",
        h(
          "g",
          { class: "pxd-chart-axis" },
          ...[0, 0.5, 1].map((t) => {
            const v = lo + (hi - lo) * t;
            return h("g", { key: t }, h("line", { x1: sx(v), x2: sx(v), y1: PAD.top, y2: hh - 20, class: "pxd-chart-grid" }), h("text", { x: sx(v), y: hh - 4, "text-anchor": "middle" }, fmt(v, { ...(series[0].format ?? { type: "number" }), precision: 0 })));
          }),
        ),
        ...points.map((p, i) => {
          const yy = PAD.top + i * rowH;
          return h(
            "g",
            { key: p },
            h("text", { x: left - 8, y: yy + rowH / 2 + 4, "text-anchor": "end", class: "pxd-chart-range-label" }, axisLabel(x(p), node.x.format?.type, r.locale)),
            h("line", { x1: sx(lows[i]), x2: sx(highs[i]), y1: yy + rowH / 2, y2: yy + rowH / 2, stroke: color(0), "stroke-width": 10, "stroke-linecap": "round" }),
            h("circle", { cx: sx(lows[i]), cy: yy + rowH / 2, r: 4, fill: color(1) }),
            h("circle", { cx: sx(highs[i]), cy: yy + rowH / 2, r: 4, fill: color(2) }),
          );
        }),
      ),
      h("ul", { class: "pxd-chart-legend" }, h("li", null, h("span", { class: "pxd-chart-swatch", style: { background: color(1) }, "aria-hidden": "true" }), b.text(series[0].label)), series[1] && h("li", null, h("span", { class: "pxd-chart-swatch", style: { background: color(2) }, "aria-hidden": "true" }), b.text(series[1].label))),
    );
  }

  if (node.intent === "matrix") {
    // A heatmap: x values down, series across, one colour shaded by value, the value printed in each cell.
    const values = points.map((p) => series.map((sr) => y(p, sr)));
    const max = Math.max(1, ...values.flat());
    return figure(
      h(
        "div",
        { class: "pxd-heatmap-scroll", "aria-hidden": "true" },
        h(
          "table",
          { class: "pxd-heatmap" },
          h("thead", null, h("tr", null, h("th", null), ...series.map((sr, si) => h("th", { key: si, scope: "col" }, b.text(sr.label))))),
          h(
            "tbody",
            null,
            ...points.map((p, i) =>
              h(
                "tr",
                { key: p },
                h("th", { scope: "row" }, xLabel(p)),
                ...series.map((sr, si) => {
                  const pct = Math.round((values[i][si] / max) * 100);
                  return h("td", { key: si, class: `pxd-heatmap-cell${pct >= 60 ? " pxd-heatmap-strong" : ""}`, style: { background: `color-mix(in srgb, var(--pxd-color-data-categorical-1) ${pct}%, var(--pxd-color-surface-subtle))` } }, fmt(values[i][si], sr.format));
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }

  if (node.intent === "hierarchy") {
    // A treemap of the first series: each x value a tile sized by its share.
    const values = points.map((p) => Math.max(0, y(p, series[0])));
    const rects = treemap(values, W, H);
    return figure(
      svg(
        `0 0 ${W} ${H}`,
        "pxd-chart-svg pxd-chart-treemap",
        ...rects.map((rc, i) => rc && h("g", { key: i }, h("rect", { x: rc.x + 1, y: rc.y + 1, width: Math.max(rc.w - 2, 0), height: Math.max(rc.h - 2, 0), fill: color(i), rx: 2 }), rc.w > 48 && rc.h > 24 && h("text", { x: rc.x + 8, y: rc.y + 18, class: "pxd-chart-tile-label" }, xLabel(points[i]).slice(0, Math.floor(rc.w / 8))))),
      ),
      h("ul", { class: "pxd-chart-legend" }, ...points.map((p, i) => h("li", { key: p }, h("span", { class: "pxd-chart-swatch", style: { background: color(i) }, "aria-hidden": "true" }), `${xLabel(p)}: ${fmt(values[i], series[0].format)}`))),
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
      svg(
        `0 0 ${W} ${H}`,
        "pxd-chart-svg pxd-chart-flow",
        ...values.flatMap((row, i) =>
          row.map((v, si) => {
            if (v <= 0) return null;
            const hh = v * scale;
            const ya = leftOff[i];
            const yb = rightOff[si];
            leftOff[i] += hh;
            rightOff[si] += hh;
            const d = `M${x0 + nodeW} ${ya} C${xm} ${ya}, ${xm} ${yb}, ${x1 - nodeW} ${yb} L${x1 - nodeW} ${yb + hh} C${xm} ${yb + hh}, ${xm} ${ya + hh}, ${x0 + nodeW} ${ya + hh} Z`;
            return h("path", { key: `${i}-${si}`, d, fill: color(si), opacity: 0.45 });
          }),
        ),
        ...points.map((p, i) => h("g", { key: p }, h("rect", { x: x0, y: leftY[i], width: nodeW, height: Math.max(leftTotals[i] * scale, 1), fill: "var(--pxd-color-border-strong)" }), h("text", { x: x0 - 8, y: leftY[i] + (leftTotals[i] * scale) / 2 + 4, "text-anchor": "end", class: "pxd-chart-flow-label" }, xLabel(p)))),
        ...series.map((sr, si) => h("g", { key: `s${si}` }, h("rect", { x: x1 - nodeW, y: rightY[si], width: nodeW, height: Math.max(rightTotals[si] * scale, 1), fill: color(si) }), h("text", { x: x1 + 8, y: rightY[si] + (rightTotals[si] * scale) / 2 + 4, class: "pxd-chart-flow-label" }, b.text(sr.label)))),
      ),
      seriesLegend,
    );
  }

  if (node.intent === "composition") {
    const values = points.map((p) => y(p, series[0]));
    const total = values.reduce((a, v) => a + v, 0) || 1;
    let offset = 0;
    const bars = values.map((v, i) => {
      const w = (v / total) * (W - 2);
      const el = h("rect", { key: i, x: 1 + offset, y: 4, width: Math.max(w - 2, 0), height: 40, fill: color(i), rx: 2 });
      offset += w;
      return el;
    });
    const legend = points.map((p, i) => ({ label: formatValue(x(p), resolveFormat(node.x.format, r.data, b.scope), r.locale), value: values[i], color: color(i), share: values[i] / total }));
    return h(
      "figure",
      { class: "pxd-chart", "aria-labelledby": titleId, "aria-describedby": summaryId, ...a11y },
      h("figcaption", null, h("span", { class: "pxd-chart-title", id: titleId }, b.text(node.title)), h("span", { class: "pxd-chart-summary", id: summaryId }, b.text(node.summary))),
      h("svg", { viewBox: `0 0 ${W} 48`, class: "pxd-chart-svg pxd-chart-bar", "aria-hidden": "true", preserveAspectRatio: "none" }, h("g", null, ...bars)),
      h("ul", { class: "pxd-chart-legend" }, ...legend.map((l) => h("li", { key: l.label }, h("span", { class: "pxd-chart-swatch", style: { background: l.color }, "aria-hidden": "true" }), `${l.label}: ${formatValue(l.value, resolveFormat(series[0].format, r.data, b.scope), r.locale)} (${formatValue(l.share, { type: "percent", precision: 0 }, r.locale)})`))),
      dataTable(),
    );
  }

  const all = points.flatMap((p) => series.map((sr) => y(p, sr)));
  const { lo, max, ticks } = verticalScale(all, node.intent === "trend");
  const scaleY = (v: number) => PAD.top + plotH - ((v - lo) / (max - lo || 1)) * plotH;
  const band = plotW / Math.max(points.length, 1);
  const labels = points.map((p) => axisLabel(x(p), node.x.format?.type, r.locale));
  const step = axisLabelStep(labels, plotW);
  const axis = h(
    "g",
    { class: "pxd-chart-axis" },
    ...ticks.map((t) => h("g", { key: t }, h("line", { x1: PAD.left, x2: W - PAD.right, y1: scaleY(t), y2: scaleY(t), class: "pxd-chart-grid" }), h("text", { x: PAD.left - 8, y: scaleY(t) + 4, "text-anchor": "end" }, formatValue(t, { ...(resolveFormat(series[0].format, r.data, b.scope) ?? { type: "number" }), precision: 0 }, r.locale)))),
    ...labels.flatMap((label, i) => (i % step ? [] : [h("text", { key: points[i], x: PAD.left + band * i + band / 2, y: H - 10, "text-anchor": "middle" }, label)])),
  );
  let body: VChild[];
  if (node.intent === "trend") {
    body = series.map((sr, si) => {
      const pts = points.map((p, i) => [PAD.left + band * i + band / 2, scaleY(y(p, sr))] as const);
      return h("g", { key: si }, h("polyline", { points: pts.map(([a, c]) => `${a},${c}`).join(" "), fill: "none", stroke: color(si), "stroke-width": 2.5 }), ...pts.map(([a, c]) => Marker(MARKERS[si], a, c, color(si))));
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
        return h("rect", { key: `${i}-${si}`, x: PAD.left + band * i + band * ((1 - fill) / 2) + barW * si, y: top, width: barW - (histogram ? 1 : 2), height: Math.max(scaleY(0) - top, 1), fill: color(si), rx: histogram ? 0 : 2 });
      }),
    );
  }
  return h(
    "figure",
    { class: "pxd-chart", "aria-labelledby": titleId, "aria-describedby": summaryId, ...a11y },
    h("figcaption", null, h("span", { class: "pxd-chart-title", id: titleId }, b.text(node.title)), h("span", { class: "pxd-chart-summary", id: summaryId }, b.text(node.summary))),
    svg(`0 0 ${W} ${H}`, "pxd-chart-svg", axis, ...body),
    series.length > 1 && h("ul", { class: "pxd-chart-legend" }, ...series.map((sr, si) => h("li", { key: si }, h("svg", { width: "12", height: "12", "aria-hidden": "true" }, Marker(MARKERS[si], 6, 6, color(si))), b.text(sr.label)))),
    dataTable(),
  );
}
