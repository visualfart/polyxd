/** Localised presentation of values. The model never pre-formats; the renderer does it here. */

export interface Format {
  type: "text" | "number" | "currency" | "percent" | "date" | "time" | "datetime" | "relativeTime" | "duration";
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
    }
  } catch {
    return String(value);
  }
}

/** Currency symbol for input adornments, e.g. "£". */
export function currencySymbol(currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}
