/**
 * Charts for the research log, drawn at build time from bench/results/leaderboard.json.
 *
 * Every chart is an inline SVG with a title and a description, followed by the same numbers as a
 * table people can open: a chart nobody can read is decoration, and we hold generated UIs to the
 * same rule. Colours come from the site's own variables, and nothing depends on colour alone.
 */

export interface Run {
  run: string;
  valid: number | null;
  score: number;
  tasks: number;
  taskTotal: number;
  expectations: number | null;
  direction: number | null;
  latency: number;
  ttft: number;
  tps: number;
}

export interface Leaderboard {
  generatedAt: string;
  benchmark: { requests: number; withTasks: number; hardware: string };
  runs: Run[];
  best: { run: string; scores: number[]; problems: { name: string; count: number }[] };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Shortens a run name to what distinguishes it. */
export const shortName = (run: string) =>
  run
    .replace("mlx-community/", "")
    .replace("-it-4bit", "")
    .replace("-4bit", "")
    .replace("gemma-4-e4b", "Gemma 4 E4B")
    .replace("Qwen3.5", "Qwen 3.5 ")
    .replace(/-tree-constrained$/, " · tree")
    .replace(/-constrained$/, " · flat")
    .replace("+sft-v1", " + SFT v1")
    .replace("+sft-v2", " + SFT v2")
    .replace("+sft-v3", " + SFT v3")
    .replace("-tree-untyped", " · tree, untyped")
    .replace("-sft-v2-fused", " + SFT v2 fused")
    .trim();

/**
 * One readable, reachable mark. A native <title> only appears on hover and never for a keyboard,
 * so every mark is also a tab stop with its own label, and charts.js reads `data-readout` into a
 * styled readout that follows both the pointer and the focus ring.
 */
const mark = (shape: string, readout: string, extra = "") =>
  `<g class="chart-mark" tabindex="0" role="img" aria-label="${esc(readout)}" data-readout="${esc(readout)}"${extra}>${shape}</g>`;

function figure(id: string, title: string, desc: string, svg: string, table: string): string {
  return `<figure class="chart" id="${id}">
<svg viewBox="0 0 720 320" role="img" aria-labelledby="${id}-t ${id}-d" class="chart-svg">
<title id="${id}-t">${esc(title)}</title>
<desc id="${id}-d">${esc(desc)}</desc>
${svg}
</svg>
<p class="chart-readout" data-readout-for="${id}" role="status" aria-live="polite"></p>
<figcaption>${esc(desc)}</figcaption>
<details class="chart-data"><summary>The numbers behind this chart</summary>${table}</details>
</figure>`;
}

const table = (head: string[], rows: string[][]) =>
  `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;

/** Mean score against median latency: what each run costs in seconds for what it gets. */
export function qualityVsSpeed(lb: Leaderboard): string {
  const W = 720;
  const H = 320;
  const pad = { l: 52, r: 24, t: 20, b: 48 };
  const runs = lb.runs;
  const maxLat = Math.max(...runs.map((r) => r.latency)) * 1.15;
  const x = (v: number) => pad.l + (v / maxLat) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / 100) * (H - pad.t - pad.b);
  const best = runs[0];
  const grid = [0, 25, 50, 75, 100]
    .map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/><text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end" class="chart-tick">${v}</text>`)
    .join("");
  const ticks = [0, 2, 4, 6]
    .filter((v) => v <= maxLat)
    .map((v) => `<text x="${x(v)}" y="${H - pad.b + 20}" text-anchor="middle" class="chart-tick">${v}s</text>`)
    .join("");
  const dots = runs
    .map((r) => {
      const isBest = r.run === best.run;
      const circle = `<circle cx="${x(r.latency).toFixed(1)}" cy="${y(r.score).toFixed(1)}" r="${isBest ? 8 : 5}" class="${isBest ? "chart-dot chart-dot-best" : "chart-dot"}"/>`;
      return mark(circle, `${shortName(r.run)}: scored ${r.score} out of 100, ${r.latency.toFixed(1)} seconds a surface, ${Math.round(r.tps)} tokens a second`);
    })
    .join("");
  const label = `<text x="${x(best.latency) + 14}" y="${y(best.score) + 4}" class="chart-label">${esc(shortName(best.run))}</text>`;
  return figure(
    "chart-quality-speed",
    "Mean score against median latency, one point per model run",
    `Each point is one model run: how well it scored out of 100, against how long a surface took to generate. The best run, ${shortName(best.run)}, scores ${best.score} in ${best.latency.toFixed(1)} seconds.`,
    `${grid}${ticks}<text x="${pad.l}" y="${H - 8}" class="chart-axis">Median latency (seconds) →</text><text x="${pad.l - 44}" y="12" class="chart-axis">Score</text>${dots}${label}`,
    table(
      ["Run", "Score", "Latency (s)", "Tokens/s"],
      runs.map((r) => [esc(shortName(r.run)), String(r.score), String(r.latency), String(r.tps)]),
    ),
  );
}

/** How often each run produced a document that passes the schema at all. */
export function validRates(lb: Leaderboard): string {
  const W = 720;
  const H = 320;
  const pad = { l: 220, r: 48, t: 12, b: 36 };
  const runs = [...lb.runs].sort((a, b) => (b.valid ?? 0) - (a.valid ?? 0));
  const bandH = (H - pad.t - pad.b) / runs.length;
  const barW = (v: number) => ((v ?? 0) / 100) * (W - pad.l - pad.r);
  const bars = runs
    .map((r, i) => {
      const yy = pad.t + i * bandH + 3;
      const h = Math.max(6, bandH - 8);
      return `<text x="${pad.l - 10}" y="${yy + h / 2 + 4}" text-anchor="end" class="chart-tick">${esc(shortName(r.run))}</text>
${mark(
        `<rect x="${pad.l}" y="${yy}" width="${barW(r.valid ?? 0).toFixed(1)}" height="${h}" rx="3" class="${(r.valid ?? 0) >= 98 ? "chart-bar chart-bar-best" : "chart-bar"}"/>`,
        `${shortName(r.run)}: ${r.valid ?? "no"}% of 50 requests produced a valid document`,
      )}
<text x="${pad.l + barW(r.valid ?? 0) + 8}" y="${yy + h / 2 + 4}" class="chart-tick">${r.valid ?? "—"}%</text>`;
    })
    .join("");
  return figure(
    "chart-valid",
    "Share of requests that produced a valid UI document, by run",
    "How often each run produced a document that passes the schema at all. Constrained decoding and the tree format are what move this number, not model size.",
    `${bars}<text x="${pad.l}" y="${H - 8}" class="chart-axis">Valid documents (% of 50 requests)</text>`,
    table(
      ["Run", "Valid"],
      runs.map((r) => [esc(shortName(r.run)), `${r.valid ?? "—"}%`]),
    ),
  );
}

/** Where the best run loses its points. */
export function lostPoints(lb: Leaderboard): string {
  const W = 720;
  const H = 320;
  const pad = { l: 190, r: 48, t: 12, b: 36 };
  const items = lb.best.problems;
  if (!items.length) return "";
  const max = Math.max(...items.map((i) => i.count));
  const bandH = (H - pad.t - pad.b) / items.length;
  const bars = items
    .map((it, i) => {
      const yy = pad.t + i * bandH + 4;
      const h = Math.max(8, bandH - 10);
      const w = (it.count / max) * (W - pad.l - pad.r);
      return `<text x="${pad.l - 10}" y="${yy + h / 2 + 4}" text-anchor="end" class="chart-tick">${esc(it.name)}</text>
${mark(
        `<rect x="${pad.l}" y="${yy}" width="${w.toFixed(1)}" height="${h}" rx="3" class="chart-bar"/>`,
        `${it.name}: ${it.count} findings`,
      )}
<text x="${pad.l + w + 8}" y="${yy + h / 2 + 4}" class="chart-tick">${it.count}</text>`;
    })
    .join("");
  return figure(
    "chart-problems",
    "What the best run got wrong, by kind of finding",
    `Every finding against ${shortName(lb.best.run)}, grouped. Agent tasks and missing components dominate: the documents are valid and safe, but they leave things out.`,
    `${bars}<text x="${pad.l}" y="${H - 8}" class="chart-axis">Findings across ${lb.benchmark.requests} requests</text>`,
    table(
      ["Kind of finding", "Count"],
      items.map((i) => [esc(i.name), String(i.count)]),
    ),
  );
}

/** How the per-request scores are spread: the mean hides a bimodal result. */
export function scoreSpread(lb: Leaderboard): string {
  const W = 720;
  const H = 320;
  const pad = { l: 52, r: 24, t: 20, b: 48 };
  const scores = lb.best.scores;
  if (!scores.length) return "";
  const bins = [0, 20, 40, 60, 80, 100].slice(0, 5).map((lo, i, arr) => {
    const hi = i === arr.length - 1 ? 101 : lo + 20;
    return { lo, hi, label: `${lo}–${hi === 101 ? 100 : hi - 1}`, n: scores.filter((s) => s >= lo && s < hi).length };
  });
  const max = Math.max(...bins.map((b) => b.n));
  const bw = (W - pad.l - pad.r) / bins.length;
  const bars = bins
    .map((b, i) => {
      const h = (b.n / max) * (H - pad.t - pad.b);
      const xx = pad.l + i * bw + 12;
      return `${mark(
        `<rect x="${xx}" y="${H - pad.b - h}" width="${bw - 24}" height="${h}" rx="4" class="${b.lo >= 80 ? "chart-bar chart-bar-best" : "chart-bar"}"/>`,
        `${b.n} of ${scores.length} requests scored ${b.label}`,
      )}
<text x="${xx + (bw - 24) / 2}" y="${H - pad.b - h - 8}" text-anchor="middle" class="chart-tick">${b.n}</text>
<text x="${xx + (bw - 24) / 2}" y="${H - pad.b + 20}" text-anchor="middle" class="chart-tick">${b.label}</text>`;
    })
    .join("");
  const top = scores.filter((s) => s >= 80).length;
  return figure(
    "chart-spread",
    "How the best run's per-request scores are spread",
    `The mean hides the shape: ${top} of ${scores.length} requests score 80 or more, and the rest sit well below. Improving the average means fixing the low tail, not nudging everything up.`,
    `${bars}<text x="${pad.l}" y="${H - 8}" class="chart-axis">Score band</text><text x="${pad.l - 40}" y="12" class="chart-axis">Requests</text>`,
    table(
      ["Score band", "Requests"],
      bins.map((b) => [b.label, String(b.n)]),
    ),
  );
}

/** What training did: base model, then each fine-tune. */
export function trainingProgress(lb: Leaderboard): string {
  const order = ["gemma-4-e4b-it-4bit-tree-constrained", "gemma-4-e4b-it-4bit+sft-v1-tree-constrained", "gemma-4-e4b-it-4bit+sft-v2-tree-constrained", "gemma-4-e4b-it-4bit+sft-v3-tree-constrained"];
  const steps = order.map((name) => lb.runs.find((r) => r.run === name)).filter(Boolean) as Run[];
  if (steps.length < 2) return "";
  const W = 720;
  const H = 320;
  const pad = { l: 52, r: 120, t: 24, b: 56 };
  const x = (i: number) => pad.l + (i / Math.max(1, steps.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => H - pad.b - (v / 100) * (H - pad.t - pad.b);
  const line = (get: (r: Run) => number, cls: string, label: string) => {
    const pts = steps.map((s, i) => `${x(i).toFixed(1)},${y(get(s)).toFixed(1)}`).join(" ");
    const last = steps[steps.length - 1];
    return `<polyline points="${pts}" class="${cls}" fill="none"/>${steps
      .map((s, i) =>
        mark(`<circle cx="${x(i).toFixed(1)}" cy="${y(get(s)).toFixed(1)}" r="5" class="${cls}-dot"/>`, `${label} at ${shortName(s.run)}: ${Math.round(get(s))}`, ` data-series="${cls}"`),
      )
      .join("")}<text x="${x(steps.length - 1) + 12}" y="${y(get(last)) + 4}" class="chart-label">${esc(label)}</text>`;
  };
  const labels = steps.map((s, i) => `<text x="${x(i)}" y="${H - pad.b + 22}" text-anchor="middle" class="chart-tick">${esc(shortName(s.run).replace("Gemma 4 E4B", "Base").replace(" · tree", ""))}</text>`).join("");
  const grid = [0, 50, 100].map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="chart-grid"/><text x="${pad.l - 10}" y="${y(v) + 4}" text-anchor="end" class="chart-tick">${v}</text>`).join("");
  return figure(
    "chart-training",
    "What each round of training changed",
    "Mean score and the share of agent tasks completed, from the base model through each fine-tune. Usefulness-aware selection is what moved agent tasks; score-only selection made the model timid.",
    `${grid}${labels}${line((r) => r.score, "chart-line", "Score")}${line((r) => (r.tasks / r.taskTotal) * 100, "chart-line-2", "Agent tasks")}`,
    table(
      ["Run", "Score", "Agent tasks"],
      steps.map((s) => [esc(shortName(s.run)), String(s.score), `${s.tasks}/${s.taskTotal}`]),
    ),
  );
}

export function allCharts(lb: Leaderboard): Record<string, string> {
  return {
    "<!--CHART:QUALITY-SPEED-->": qualityVsSpeed(lb),
    "<!--CHART:VALID-->": validRates(lb),
    "<!--CHART:PROBLEMS-->": lostPoints(lb),
    "<!--CHART:SPREAD-->": scoreSpread(lb),
    "<!--CHART:TRAINING-->": trainingProgress(lb),
  };
}
