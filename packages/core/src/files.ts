/** What a FileInput says about its limits, and whether a file meets them. */

const UNITS = ["byte", "kilobyte", "megabyte", "gigabyte"] as const;

/** 1.5 MB in binary units, as the file chooser and the OS say it. */
export function formatBytes(n: number, locale: string): string {
  let i = 0;
  let v = n;
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024;
    i++;
  }
  try {
    return new Intl.NumberFormat(locale, { style: "unit", unit: UNITS[i], unitDisplay: "short", maximumFractionDigits: v < 10 ? 1 : 0 }).format(v);
  } catch {
    return `${Math.round(v * 10) / 10} ${["B", "KB", "MB", "GB"][i]}`;
  }
}

/** '.pdf' → 'PDF', 'image/*' → 'images', 'application/zip' → 'ZIP'. */
export function describeType(a: string): string {
  const t = a.trim().toLowerCase();
  if (t.startsWith(".")) return t.slice(1).toUpperCase();
  const wild: Record<string, string> = { "image/*": "images", "video/*": "videos", "audio/*": "audio", "text/*": "text files" };
  if (wild[t]) return wild[t];
  if (t === "application/pdf") return "PDF";
  const sub = t.split("/")[1];
  return sub ? sub.replace(/^(x-|vnd\.)/, "").toUpperCase() : a;
}

export function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} or ${items[items.length - 1]}`;
}

export function matchesAccept(file: { name: string; type: string }, accept: string[]): boolean {
  if (accept.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.some((a) => {
    const t = a.trim().toLowerCase();
    if (t.startsWith(".")) return name.endsWith(t);
    if (t.endsWith("/*")) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

/** The limits, said before choosing: "Accepts PDF or images. Up to 5 MB each." */
export function fileLimits(accept: string[], maxSize: number | undefined, multiple: boolean, locale: string): string {
  const acceptText = accept.length ? listText(accept.map(describeType)) : "";
  return [acceptText && `Accepts ${acceptText}.`, maxSize && `Up to ${formatBytes(maxSize, locale)}${multiple ? " each" : ""}.`].filter(Boolean).join(" ");
}

/** Why a file was refused, or nothing when it is fine. */
export function refuseFile(file: { name: string; size: number; type: string }, accept: string[], maxSize: number | undefined, locale: string): string | undefined {
  if (maxSize && file.size > maxSize) return `${file.name} is ${formatBytes(file.size, locale)}; the limit is ${formatBytes(maxSize, locale)}.`;
  const acceptText = accept.length ? listText(accept.map(describeType)) : "";
  if (!matchesAccept(file, accept)) return `${file.name} isn't an accepted type${acceptText ? ` (${acceptText})` : ""}.`;
  return undefined;
}
