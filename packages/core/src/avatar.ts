/** A face without a picture: initials on a tone chosen per name; and the icon set every renderer draws from. */

/** A stable tone per name, from the pack's container colours. */
const TONES = ["primary", "secondary", "tertiary", "success", "warning"];

export function avatarTone(name: string): string {
  return TONES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length];
}

/** Up to three characters of reference are the initials themselves; longer references are host media. */
export function initialsOf(ref: string, name: string): string {
  return (ref && ref.length <= 3 ? ref : name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2)).toUpperCase();
}

/** A reference longer than three characters is a host media reference to resolve. */
export const isMediaRef = (ref: string): boolean => ref.length > 3;

export const ICON_PATHS: Record<string, string> = {
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
  menu: "M4 6h16M4 12h16M4 18h16",
  home: "M4 11 12 4l8 7M6 10v10h12V10",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 15a1.7 1.7 0 0 0 .3 1.8 2 2 0 1 1-2.8 2.8 1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2 2 2 0 1 1-2.8-2.8A1.7 1.7 0 0 0 2.1 14a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9 2 2 0 1 1 2.8-2.8A1.7 1.7 0 0 0 9 3.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2 2 2 0 1 1 2.8 2.8A1.7 1.7 0 0 0 21 10a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 1z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  people: "M9 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6",
  card: "M2 6h20v13H2zM2 10h20",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  dots: "M12 5h.01M12 12h.01M12 19h.01",
  sort: "M8 9l4-4 4 4M8 15l4 4 4-4",
  sortUp: "M12 19V5M6 11l6-6 6 6",
  sortDown: "M12 5v14M6 13l6 6 6-6",
  chevronLeft: "M15 5l-7 7 7 7",
  chevronRight: "M9 5l7 7-7 7",
  chevronDown: "m6 9 6 6 6-6",
  // The rest of Navigation's icon set: a product's sections.
  orders: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6",
  products: "M12 3 3 7.5v9L12 21l9-4.5v-9zM3 7.5l9 4.5 9-4.5M12 12v9",
  customers: "M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21a8 8 0 0 1 16 0",
  discounts: "M19 5 5 19M7.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM16.5 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z",
  analytics: "M3 17l5-6 4 3 5-7 4 4M3 21h18",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  help: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01",
  folder: "M3 6h6l2 2h10v11H3z",
  star: "m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  layers: "m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
};

/** The path for an icon name; an unknown name draws the info glyph. */
export const iconPath = (name: string): string => ICON_PATHS[name] ?? ICON_PATHS.info;

/** The Status kinds' icons. */
export const STATUS_ICON: Record<string, string> = { info: "info", success: "check", warning: "alert", error: "alert", empty: "inbox", undo: "check" };

/** The star every Rating draws. */
export const STAR_PATH = "M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.8L12 17.6 6 21l1.3-6.8-5-4.7 6.8-.8z";
