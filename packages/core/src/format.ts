/** Localised presentation of values. The model never pre-formats; the renderer does it here. */
import { resolve, type Scope } from "./data.ts";

export interface Format {
  type: "text" | "number" | "currency" | "percent" | "date" | "time" | "datetime" | "relativeTime" | "duration" | "color" | "bytes";
  /** ISO 4217 code, or a binding to one (resolved by the renderer before formatting) */
  currency?: string | { path: string };
  precision?: number;
}

export function formatValue(value: unknown, format: Format | undefined, locale: string, now = Date.now()): string {
  if (value === null || value === undefined || value === "") return "—";
  if (!format || format.type === "text") return Array.isArray(value) ? value.join(", ") : String(value);
  const n = typeof value === "number" ? value : Number(value);
  const digits = format.precision === undefined ? {} : { minimumFractionDigits: format.precision, maximumFractionDigits: format.precision };
  try {
    switch (format.type) {
      case "number":
        return new Intl.NumberFormat(locale, digits).format(n);
      case "currency":
        return new Intl.NumberFormat(locale, { style: "currency", currency: typeof format.currency === "string" ? format.currency : "USD", ...digits }).format(n);
      case "percent":
        return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: format.precision ?? 1 }).format(n);
      case "date":
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(String(value)));
      case "time":
        return new Intl.DateTimeFormat(locale, { timeStyle: "short", timeZone: "UTC" }).format(new Date(String(value)));
      case "datetime":
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(String(value)));
      case "relativeTime": {
        const diff = (new Date(String(value)).getTime() - now) / 1000;
        const units: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
        for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
        return rtf.format(Math.round(diff), "second");
      }
      case "duration": {
        const mins = Math.round(n / 60);
        return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
      }
      case "color":
        // The value is the colour itself; renderers show a swatch of it beside this text.
        return String(value).trim();
      case "bytes": {
        // 1.2 MB: decimal units, one decimal past kilobytes.
        const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;
        let i = 0;
        let v = Math.abs(n);
        while (v >= 1000 && i < units.length - 1) (v /= 1000), i++;
        if (i === 0) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n)} B`;
        return new Intl.NumberFormat(locale, { style: "unit", unit: units[i], unitDisplay: "short", maximumFractionDigits: format.precision ?? 1 }).format(n < 0 ? -v : v);
      }
    }
  } catch {
    return String(value);
  }
}

/** A CSS colour a swatch can safely take as its background: named, hex, rgb()/hsl()/oklch() etc. Anything else is not painted. */
export function safeColor(value: unknown): string | undefined {
  const v = String(value ?? "").trim();
  return /^(#[0-9a-f]{3,8}|[a-z]{3,20}|(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\([\d.,%\s\/-]+\))$/i.test(v) ? v : undefined;
}

/** Currency symbol for input adornments, e.g. "£". */
export function currencySymbol(currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** A format's currency may itself be bound to data (e.g. the account's currency). */
export function resolveFormat(format: Format | undefined, data: unknown, scope: Scope): Format | undefined {
  if (!format?.currency || typeof format.currency === "string") return format;
  return { ...format, currency: resolve<string>(format.currency, data, scope) };
}

/** A count as people read it, in the locale: 1,204. */
export const formatCount = (n: number, locale: string): string => new Intl.NumberFormat(locale).format(n);

/** A whole percentage: 0.42 → "42%". */
export const formatPercent = (fraction: number, locale: string): string => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(fraction);
