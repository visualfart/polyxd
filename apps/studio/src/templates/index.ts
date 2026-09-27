/**
 * A template as a design system: its pack read into Studio's token graph, and the little a
 * chooser needs to tell them apart (a name, one line of character, a strip of swatches from its
 * own tokens). "Blank" is the Mono template with its brand ramp turned grey: the same structure
 * (a palette, the pack's roles, the 87 semantic tokens), nothing chosen yet.
 */
import { index, resolve, resolveDeep, type Graph, type Mode } from "../import/read.ts";
import { packGraph } from "../tokens/pack.ts";
import { applyChanges } from "../tokens/edit.ts";
import { rebrandChanges } from "../tokens/ramp.ts";
import { cssDim, firstFamily, isDim } from "../tokens/value.ts";
import { TEMPLATE_NAMES, TEMPLATE_PACKS, characterOf, isTemplateName, type TemplateName } from "./packs.ts";

export { TEMPLATE_NAMES, TEMPLATE_PACKS, characterOf, isTemplateName, type TemplateName };

export const BLANK = "blank";
export type StartName = TemplateName | typeof BLANK;
export const isStartName = (s: unknown): s is StartName => s === BLANK || isTemplateName(s);

/** The pack's tokens as a graph: sets per file, modes as the manifest declares, the semantic file as the semantic tier. */
export function templateGraph(name: StartName): Graph {
  if (name === BLANK) {
    const mono = templateGraph("mono");
    // Grey: chroma 0 at Mono's lightness steps, so every contrast pair still passes.
    return applyChanges(mono, rebrandChanges(mono, 275, 0));
  }
  const pack = TEMPLATE_PACKS[name];
  return packGraph({ name, modes: pack.manifest.modes, defaultMode: pack.manifest.defaultMode, files: pack.files });
}

export interface TemplateSummary {
  name: StartName;
  displayName: string;
  /** One line of character, from the pack's provenance */
  character: string;
  modes: string[];
  tokens: number;
  /** Colours from its own tokens, in its default mode, for the swatch strip */
  swatches: { role: string; value: string }[];
  /** Two things a swatch can't show: the radius the pack uses and the face its titles are set in */
  radius: string;
  font: string;
  /** Whether the pack carries an extras stylesheet (what tokens can't express) */
  extras: boolean;
}

const SWATCH_ROLES = ["color.surface.default", "color.surface.subtle", "color.text.default", "color.text.muted", "color.action.primary.background", "color.text.link", "color.status.success.emphasis", "color.status.warning.emphasis", "color.status.danger.emphasis", "color.border.strong"];

const dim = (v: unknown) => (isDim(v) ? cssDim(v) : typeof v === "string" || typeof v === "number" ? String(v) : "");

export function templateSummary(name: StartName): TemplateSummary {
  const graph = templateGraph(name);
  const mode: Mode | undefined = graph.modes[0];
  const byPath = index(graph);
  const value = (path: string) => resolveDeep(graph, `{${path}}`, mode, byPath);
  const swatches = SWATCH_ROLES.map((role) => ({ role, value: String(resolve(graph, role, mode, byPath).value ?? "") })).filter((s) => s.value && !s.value.startsWith("{"));
  const title = value("type.title.page") as Record<string, unknown> | undefined;
  const manifest = name === BLANK ? { displayName: "Blank", extras: undefined } : TEMPLATE_PACKS[name].manifest;
  return {
    name,
    displayName: manifest.displayName ?? name,
    character: name === BLANK ? "Nothing chosen yet: a neutral grey ramp in Mono's structure, with every role mapped; the fastest way to a design system that is entirely yours" : characterOf(TEMPLATE_PACKS[name].manifest),
    modes: graph.modes.map((m) => m.name),
    tokens: graph.tokens.length,
    swatches,
    radius: dim(value("radius.default")),
    font: firstFamily(title?.fontFamily),
    extras: !!manifest.extras,
  };
}

export const allTemplates = (): TemplateSummary[] => [BLANK, ...TEMPLATE_NAMES].map((n) => templateSummary(n as StartName));
