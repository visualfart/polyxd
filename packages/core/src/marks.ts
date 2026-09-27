/** The small marks: a metric's change, a gauge's state, a rating's words, a code block's mask. */
import { formatValue, type Format } from "./format.ts";

export interface MetricChange {
  /** Shown: "▲ 8%" */
  text: string;
  /** Read: "up 8%" */
  spoken: string;
  tone: "positive" | "negative" | "neutral";
}

/** A change is good or bad depending on which way is favourable; zero is neither. */
export function metricChange(raw: unknown, favorable: string | undefined, format: Format | undefined, locale: string): MetricChange | undefined {
  if (typeof raw !== "number") return undefined;
  const fav = favorable ?? "increase";
  const dir = raw > 0 ? "up" : raw < 0 ? "down" : "unchanged";
  const tone = fav === "none" || raw === 0 ? "neutral" : (raw > 0) === (fav === "increase") ? "positive" : "negative";
  const amount = formatValue(Math.abs(raw), format, locale);
  return { text: `${raw > 0 ? "▲" : raw < 0 ? "▼" : "■"} ${amount}`, spoken: dir === "unchanged" ? "unchanged" : `${dir} ${amount}`, tone };
}

/** What a meter's tone means, said in words next to the readout. */
export function meterHint(fraction: number, thresholds: { warning?: number; danger?: number } | undefined): { tone?: string; hint?: string } {
  if (fraction >= 1) return { tone: "danger", hint: "full" };
  if (thresholds?.danger !== undefined && fraction >= thresholds.danger) return { tone: "danger", hint: "nearly full" };
  if (thresholds?.warning !== undefined && fraction >= thresholds.warning) return { tone: "warning", hint: "getting full" };
  return {};
}

export interface GaugeState {
  fraction: number;
  percent: number;
  /** The real amount and bound when there is one, otherwise a percentage */
  valueProps: Record<string, number | string | boolean>;
  readout: string;
  tone?: string;
  hint?: string;
  valuetext: string;
  indeterminate: boolean;
}

/** A progress bar's or meter's numbers, from its value, bound and thresholds. */
export function gaugeState(node: { kind?: string; thresholds?: any; tone?: string; format?: Format }, rawValue: unknown, rawMax: unknown, indeterminate: boolean, caption: string | undefined, locale: string): GaugeState {
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  const m = rawMax !== undefined ? Number(rawMax) : undefined;
  const max = m !== undefined && Number.isFinite(m) && m > 0 ? m : undefined;
  const fraction = Number.isFinite(value) ? Math.max(0, Math.min(1, max !== undefined ? value / max : value)) : 0;
  const readout = node.format ? formatValue(rawValue, node.format, locale) : formatValue(fraction, { type: "percent", precision: 0 }, locale);
  const meter = node.kind === "meter";
  const byThreshold = meter ? meterHint(fraction, node.thresholds) : {};
  const tone = node.tone ?? byThreshold.tone;
  const hint = meter ? byThreshold.hint : undefined;
  const valuetext = [readout, caption, hint].filter(Boolean).join(", ");
  const percent = Math.round(fraction * 100);
  const valueProps: Record<string, number | string | boolean> = indeterminate
    ? { "aria-busy": true }
    : max !== undefined
      ? { "aria-valuemin": 0, "aria-valuemax": max, "aria-valuenow": Number.isFinite(value) ? value : 0, "aria-valuetext": valuetext }
      : { "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": percent, "aria-valuetext": valuetext };
  return { fraction, percent, valueProps, readout, tone, hint, valuetext, indeterminate };
}

export const starsLabel = (n: number): string => `${n} ${n === 1 ? "star" : "stars"}`;

/** A read-only rating as an image is named: "4.6 out of 5", or "not yet rated". */
export const ratingSaid = (scoreText: string | undefined, max: number): string => (scoreText !== undefined ? `${scoreText} out of ${max}` : "not yet rated");

/** A secret is masked to the same length until shown. */
export const maskSecret = (text: string): string => text.replace(/[^\s]/g, "•");

/** The identity size names and their pixels. */
export const IDENTITY_SIZE: Record<string, number> = { small: 24, default: 40, large: 64 };

/** A group's summary when the host gives none: first names and how many more. */
export function groupSummary(members: { name: string }[], max: number): string {
  const first = (n: string) => n.split(/\s+/)[0] || n;
  const shown = members.slice(0, max);
  const rest = members.slice(max);
  return rest.length ? `${shown.map((m) => first(m.name)).join(", ")} and ${rest.length} more` : shown.map((m) => first(m.name)).join(", ");
}
