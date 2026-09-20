/**
 * Turning somebody else's design tokens into a Polyxd pack.
 *
 * The thirteen packs in this repository were each written by hand, because each design system
 * names things its own way and the interesting decisions are the ones a generator can't make. A
 * team adopting Polyxd has one design system — theirs — and no appetite for that.
 *
 * So this does the boring nine tenths: read their variables, guess which of the contract's tokens
 * each one is, measure whether the guesses actually pass, and write down every guess it made in a
 * mapping file the team can correct. It is explicitly a draft. What makes it useful is not the
 * guessing but the report: `radius.control: no variable matched` is a question someone can answer
 * in a second, where "write a design-system pack" is a week nobody starts.
 */
import { contrastRatio, luminance, toRgb } from "@polyxd/spec";
import type { Vars } from "./index.ts";

export interface Guess {
  /** The contract token, e.g. "color.surface.default" */
  token: string;
  /** The source variable it came from, without the leading dashes */
  from?: string;
  /** Why this variable and not another */
  why: string;
  /** How sure: "named" (the name said so), "measured" (the value said so), "default" (nothing did) */
  how: "named" | "measured" | "derived" | "default";
}

export interface Mapping {
  $comment: string;
  /** contract token → source variable name, or a literal value */
  tokens: Record<string, string>;
}

/** Words a design system uses for each role. Order matters: the first match wins. */
const NAMES: Record<string, RegExp[]> = {
  "color.surface.default": [/^(colors?-)?(bg|background)$/, /background-(default|primary|base|canvas)/, /surface(-default)?$/, /^base$/],
  "color.surface.subtle": [/(bg|background|surface)-(subtle|muted|secondary|alt|sunken|inset)/, /^muted$/],
  "color.surface.raised": [/(bg|background|surface)-(raised|card|panel|elevated)/, /^card$/, /^paper$/],
  "color.surface.overlay": [/(bg|background|surface)-(overlay|popover|menu|dialog|modal)/, /^popover$/],
  "color.surface.inverse": [/(bg|background|surface)-(inverse|inverted|emphasis)/],
  "color.text.default": [/^(colors?-)?(fg|foreground|text|ink)$/, /(text|fg|foreground)-(default|primary|body|base)/],
  "color.text.muted": [/(text|fg|foreground)-(muted|secondary|subtle|tertiary|dim)/],
  "color.text.inverse": [/(text|fg|foreground)-(inverse|inverted|on-?emphasis|on-?primary)/],
  "color.text.link": [/(text|fg|foreground)?-?link/, /^link$/, /(text|fg)-(accent|brand)/],
  "color.border.default": [/^(colors?-)?border$/, /border-(default|primary|base)/, /^divider$/, /^outline$/],
  "color.border.strong": [/border-(strong|emphasis|emphasized|heavy|dark)/],
  "color.border.focus": [/focus(-ring|-outline)?(-color)?$/, /^ring$/, /border-focus/],
  "color.action.primary.background": [/(button|btn)-primary(-bg|-background)?$/, /^primary$/, /primary-(bg|background|default|solid)/, /^brand$/, /accent-(bg|background)/],
  "color.action.primary.foreground": [/(button|btn)-primary-(fg|foreground|text|color)/, /^primary-foreground$/, /on-?primary/],
  "color.action.secondary.background": [/(button|btn)-(secondary|default)(-bg|-background)?$/, /^secondary$/, /secondary-(bg|background)/],
  "color.action.secondary.foreground": [/(button|btn)-(secondary|default)-(fg|foreground|text)/, /^secondary-foreground$/],
  "color.action.secondary.border": [/(button|btn)-(secondary|default)-border/],
  "color.action.danger.background": [/(danger|destructive|critical|error|negative)(-bg|-background|-solid|-emphasis)?$/],
  "color.action.danger.foreground": [/(danger|destructive|critical|error|negative)-(fg|foreground|text)/, /on-?(danger|destructive|error)/],
  "color.selection.background": [/(selection|selected)(-bg|-background)?$/, /^accent$/],
  "color.selection.foreground": [/(selection|selected)-(fg|foreground|text)/, /^accent-foreground$/],
  "color.status.info.background": [/(info|informative)-(bg|background|muted|subtle|surface)/],
  "color.status.info.foreground": [/(info|informative)-(fg|foreground|text)/],
  "color.status.info.emphasis": [/(info|informative)(-emphasis|-solid|-strong)?$/],
  "color.status.success.background": [/(success|positive)-(bg|background|muted|subtle|surface)/],
  "color.status.success.foreground": [/(success|positive)-(fg|foreground|text)/],
  "color.status.success.emphasis": [/(success|positive)(-emphasis|-solid|-strong)?$/],
  "color.status.warning.background": [/(warning|caution|attention)-(bg|background|muted|subtle|surface)/],
  "color.status.warning.foreground": [/(warning|caution|attention)-(fg|foreground|text)/],
  "color.status.warning.emphasis": [/(warning|caution|attention)(-emphasis|-solid|-strong)?$/],
  "color.status.danger.background": [/(danger|destructive|critical|error|negative)-(bg|background|muted|subtle|surface)/],
  "color.status.danger.foreground": [/(danger|destructive|critical|error|negative)-(fg|foreground|text)/],
  "color.status.danger.emphasis": [/(danger|destructive|critical|error|negative)(-emphasis|-solid|-strong)?$/],
  "color.scrim": [/(scrim|backdrop|overlay-bg)/],
  "radius.small": [/rad(ius)?-(xs|sm|small|1)$/],
  "radius.control": [/(button|btn|control|input)-rad(ius)?/, /rad(ius)?-(md|medium|default|2)$/],
  "radius.default": [/rad(ius)?-(md|medium|default|2)$/],
  "radius.large": [/rad(ius)?-(lg|large|xl|3)$/],
  "radius.full": [/rad(ius)?-(full|round|pill|circle)$/],
  "border.width.default": [/border-width(-default|-thin|-1)?$/],
  "border.width.strong": [/border-width-(strong|thick|2)/],
  "focus.ring.width": [/focus-(ring|outline)-width/],
  "focus.ring.offset": [/focus-(ring|outline)-offset/],
  "shadow.raised": [/shadow-(sm|small|1|raised|card)$/],
  "shadow.overlay": [/shadow-(lg|large|3|overlay|popover|modal)$/],
  "space.inset.compact": [/(space|spacing|padding)-(xs|1|compact)$/],
  "space.inset.default": [/(space|spacing|padding)-(md|4|default)$/],
  "space.inset.comfortable": [/(space|spacing|padding)-(lg|6|comfortable)$/],
  "space.stack.tight": [/(space|spacing|gap)-(xs|1)$/],
  "space.stack.default": [/(space|spacing|gap)-(sm|2)$/],
  "space.stack.loose": [/(space|spacing|gap)-(md|4)$/],
  "space.stack.section": [/(space|spacing|gap)-(xl|8)$/],
  "space.inline.tight": [/(space|spacing|gap)-(xs|1)$/],
  "space.inline.default": [/(space|spacing|gap)-(sm|2)$/],
  "space.inline.loose": [/(space|spacing|gap)-(md|4)$/],
  "size.icon.small": [/(icon|size)-(sm|small|4)$/],
  "size.icon.default": [/(icon|size)-(md|medium|5)$/],
  "motion.duration.instant": [/duration-(50|75|100|instant|fastest)$/],
  "motion.duration.short": [/duration-(150|200|short|fast)$/],
  "motion.duration.medium": [/duration-(200|300|medium|moderate|normal)$/],
  "motion.duration.long": [/duration-(400|500|long|slow)$/],
  "motion.easing.standard": [/eas(e|ing)-(in-out|standard|default)$/],
  "motion.easing.enter": [/eas(e|ing)-(out|enter|decelerate)$/],
  "motion.easing.exit": [/eas(e|ing)-(in|exit|accelerate)$/],
};

const isColour = (v: string) => /^(#|rgb|hsl|oklch|lab|color-mix|white$|black$)/i.test(v.trim());
const isLength = (v: string) => /^-?[\d.]+(px|rem|em)$/.test(v.trim());
const isDuration = (v: string) => /^[\d.]+m?s$/.test(v.trim());
const isEasing = (v: string) => /^cubic-bezier\(/.test(v.trim());
const isShadow = (v: string) => /\d+px .*(rgb|hsl|#|color-mix)/i.test(v.trim());

const KIND: Record<string, (v: string) => boolean> = {
  color: isColour,
  radius: isLength,
  space: isLength,
  size: isLength,
  border: isLength,
  focus: isLength,
  shadow: isShadow,
  motion: (v) => isDuration(v) || isEasing(v),
};

/**
 * Guesses which of the team's variables is each contract token.
 *
 * Names first, because a variable called `--border-focus` is telling you what it is. Then
 * measurement, for the handful of roles whose job is defined by contrast rather than by name:
 * the page is the lightest neutral, body text is the one furthest from it.
 */
export function inferMapping(vars: Vars): { mapping: Mapping; guesses: Guess[] } {
  const clean = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k.replace(/^--/, ""), v.trim()]));
  const names = Object.keys(clean);
  // `--acme-border` is the same variable as `--border` as far as a pattern is concerned. Rather
  // than guess one project-wide prefix — real files mix `--acme-bg` with a bare `--primary` — a
  // pattern is tried against the name and against every suffix of it.
  const spellings = (n: string) => {
    const parts = n.split("-");
    return parts.map((_, i) => parts.slice(i).join("-"));
  };
  const guesses: Guess[] = [];

  const kindOf = (token: string) => KIND[token.split(".")[0]] ?? (() => true);

  for (const [token, patterns] of Object.entries(NAMES)) {
    const fits = kindOf(token);
    let found: string | undefined;
    for (const pattern of patterns) {
      // One variable can serve several tokens, and usually does: a system with one small spacing
      // step uses it for tight stacks and tight inline gaps alike.
      found = names.find((n) => fits(clean[n]) && spellings(n).some((spelling) => pattern.test(spelling)));
      if (found) break;
    }
    if (found) guesses.push({ token, from: found, why: `"${found}" reads as ${token}`, how: "named" });
  }

  // Measurement, for what naming didn't reach. A design system always has a page colour and a
  // text colour even when it calls them something this doesn't recognise.
  const colours = names.filter((n) => isColour(clean[n]));
  const has = (token: string) => guesses.some((g) => g.token === token);
  if (colours.length && (!has("color.surface.default") || !has("color.text.default"))) {
    const sorted = [...colours].sort((a, b) => {
      try {
        return luminance(toRgb(clean[b])) - luminance(toRgb(clean[a]));
      } catch {
        return 0;
      }
    });
    if (!has("color.surface.default") && sorted[0]) {
      guesses.push({ token: "color.surface.default", from: sorted[0], why: `the lightest colour you define`, how: "measured" });
    }
    const page = clean[guesses.find((g) => g.token === "color.surface.default")?.from ?? sorted[0]];
    if (!has("color.text.default")) {
      const readable = sorted.filter((n) => {
        try {
          return contrastRatio(clean[n], page) >= 4.5;
        } catch {
          return false;
        }
      });
      const pick = readable[readable.length - 1];
      if (pick) guesses.push({ token: "color.text.default", from: pick, why: `${contrastRatio(clean[pick], page).toFixed(1)}:1 on your page colour`, how: "measured" });
    }
  }

  // What one role implies about another. A system that names a success colour has said enough for
  // the chart's positive series; one that has an informative tint has said enough for selection.
  // Each of these is recorded as derived, so the report says where it came from.
  const DERIVED: [string, string, string][] = [
    ["color.selection.background", "color.status.info.background", "your informative tint is what a selected row is"],
    ["color.selection.foreground", "color.status.info.foreground", "the text that sits on that tint"],
    ["color.data.positive", "color.status.success.emphasis", "your success colour"],
    ["color.data.negative", "color.status.danger.emphasis", "your danger colour"],
    ["color.data.neutral", "color.text.muted", "your muted text colour"],
    ["color.data.categorical.1", "color.status.info.emphasis", "your informative colour"],
    ["color.data.categorical.2", "color.status.success.emphasis", "your success colour"],
    ["color.data.categorical.3", "color.action.primary.background", "your primary colour"],
    ["color.data.categorical.4", "color.status.warning.emphasis", "your warning colour"],
    ["color.data.categorical.5", "color.status.danger.emphasis", "your danger colour"],
    ["color.data.categorical.6", "color.border.strong", "your strongest neutral"],
    ["radius.default", "radius.control", "the radius your controls use"],
    ["color.status.danger.background", "color.action.danger.background", "your danger colour; a tint would be better if you have one"],
    ["color.status.danger.foreground", "color.action.danger.foreground", "the text that sits on your danger colour"],
    ["color.status.danger.emphasis", "color.action.danger.background", "your danger colour"],
    ["color.surface.overlay", "color.surface.raised", "the surface your cards use"],
    ["color.surface.inverse", "color.text.default", "the opposite end of your neutral range"],
    ["color.text.inverse", "color.surface.default", "your page colour, read on a dark surface"],
    ["space.stack.tight", "space.inline.tight", "the same small step"],
    ["space.inline.tight", "space.stack.tight", "the same small step"],
    ["space.inline.default", "space.stack.default", "the same step"],
    ["space.inline.loose", "space.stack.loose", "the same step"],
    ["space.stack.loose", "space.inset.default", "the same step"],
  ];
  for (const [token, from, why] of DERIVED) {
    if (guesses.some((g) => g.token === token)) continue;
    const source = guesses.find((g) => g.token === from);
    if (source?.from) guesses.push({ token, from: source.from, why: `${why} (from ${from})`, how: "derived" });
  }

  const mapping: Mapping = {
    $comment:
      "Draft mapping from your design system's variables to the Polyxd token contract. Every line is a guess this tool made or a blank it couldn't fill. Correct the wrong ones, fill the empty ones, and run `polyxd pack` again.",
    tokens: Object.fromEntries(guesses.map((g) => [g.token, g.from!])),
  };
  return { mapping, guesses };
}
