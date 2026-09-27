/*
 * Shortcut keys: how each is shown on Apple, shown elsewhere, written in aria-keyshortcuts, and
 * what KeyboardEvent.key reports. Letters, digits and F-keys are derived. 'mod' is a modifier
 * that resolves per platform, so it is handled in parseShortcut.
 */
export const SHORTCUT_KEYS: Record<string, [apple: string, other: string, aria: string, event: string]> = {
  ctrl: ["⌃", "Ctrl", "Control", "ctrlKey"],
  alt: ["⌥", "Alt", "Alt", "altKey"],
  shift: ["⇧", "Shift", "Shift", "shiftKey"],
  enter: ["↵", "Enter", "Enter", "enter"],
  escape: ["⎋", "Esc", "Escape", "escape"],
  space: ["Space", "Space", "Space", " "],
  tab: ["⇥", "Tab", "Tab", "tab"],
  backspace: ["⌫", "Backspace", "Backspace", "backspace"],
  delete: ["⌦", "Del", "Delete", "delete"],
  arrowup: ["↑", "↑", "ArrowUp", "arrowup"],
  arrowdown: ["↓", "↓", "ArrowDown", "arrowdown"],
  arrowleft: ["←", "←", "ArrowLeft", "arrowleft"],
  arrowright: ["→", "→", "ArrowRight", "arrowright"],
  home: ["Home", "Home", "Home", "home"],
  end: ["End", "End", "End", "end"],
  slash: ["/", "/", "/", "/"],
  comma: [",", ",", ",", ","],
  period: [".", ".", ".", "."],
};
export const MODIFIER_FLAGS = ["metaKey", "ctrlKey", "altKey", "shiftKey"] as const;
export type ModifierFlag = (typeof MODIFIER_FLAGS)[number];

export interface Shortcut {
  /** The keys as shown, one per <kbd> */
  hint: string[];
  /** For aria-keyshortcuts */
  aria: string;
  flags: Set<ModifierFlag>;
  /** What KeyboardEvent.key reports, lower-cased */
  key: string;
}

/** Splits "mod+shift+d" into what to show, what to announce, and what to match on keydown. */
export function parseShortcut(shortcut: string, apple: boolean): Shortcut {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.pop()!;
  const hint: string[] = [];
  const aria: string[] = [];
  const flags = new Set<ModifierFlag>();
  for (const m of parts) {
    const [a, o, name, flag] = m === "mod" ? (apple ? ["⌘", "Ctrl", "Meta", "metaKey"] : SHORTCUT_KEYS.ctrl) : SHORTCUT_KEYS[m];
    hint.push(apple ? a : o);
    aria.push(name);
    flags.add(flag as ModifierFlag);
  }
  const named = SHORTCUT_KEYS[key];
  hint.push(named ? (apple ? named[0] : named[1]) : key.toUpperCase());
  aria.push(named ? named[2] : key.toUpperCase());
  return { hint, aria: aria.join("+"), flags, key: named ? named[3] : key };
}

/** The parts of a keyboard event a shortcut is matched on. */
export interface KeyLike {
  key: string;
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/**
 * Whether a key event is this shortcut: the modifiers exactly, and the key by name, or by physical
 * key for letters and digits (Alt on a Mac rewrites e.key to a symbol).
 */
export function shortcutMatches(s: Shortcut, e: KeyLike): boolean {
  if (!MODIFIER_FLAGS.every((f) => e[f] === s.flags.has(f))) return false;
  const physical = /^[a-z0-9]$/.test(s.key) && e.code.toLowerCase() === (/\d/.test(s.key) ? `digit${s.key}` : `key${s.key}`);
  return e.key.toLowerCase() === s.key || physical;
}

/** Typing into a field must never fire an unmodified shortcut (shift alone still types). */
export const unmodified = (s: Shortcut): boolean => !s.flags.has("metaKey") && !s.flags.has("ctrlKey") && !s.flags.has("altKey");

/** Whether a platform string names an Apple device, where 'mod' is ⌘. */
export const isApplePlatform = (platform: string): boolean => /mac|iphone|ipad|ipod/i.test(platform);
