import { useSurface } from "../context.tsx";

/** A person or thing's face: an image when the host can resolve the reference, otherwise initials. */
export function Avatar({ value, name, size = 40 }: { value?: unknown; name: string; size?: number }) {
  const s = useSurface();
  const ref = typeof value === "string" ? value : "";
  const url = ref.length > 3 ? s.resolveMedia?.(ref) : undefined;
  const initials = (ref && ref.length <= 3 ? ref : name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)).toUpperCase();
  // A stable tone per name, from the pack's container colours.
  const tones = ["primary", "secondary", "tertiary", "success", "warning"];
  const tone = tones[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % tones.length];
  return url ? (
    <img className="pxd-avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />
  ) : (
    <span className={`pxd-avatar pxd-avatar-${tone}`} aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials}
    </span>
  );
}

const PATHS: Record<string, string> = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3",
  check: "M20 6 9 17l-5-5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 16v-4M12 8h.01",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  tag: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01",
  mail: "M3 5h18v14H3zM3 7l9 6 9-6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7H2v-7z",
  filter: "M3 5h18l-7 8v6l-4 2v-8z",
  close: "M18 6 6 18M6 6l12 12",
  dash: "M6 12h12",
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
