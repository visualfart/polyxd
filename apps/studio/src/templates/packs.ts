/**
 * The twelve template packs, bundled into the Worker as JSON the way Studio reads the schema:
 * each pack's manifest and token files, straight from packages/ds-*, so a template in Studio is
 * exactly the pack that ships. "Start from a template" copies one into a workspace as a design
 * system of its own; from then on it is the team's, and the pack is not consulted again.
 *
 * The import block is static (a Worker can't read a directory), one line per file. Adding a
 * template is adding its lines here and its name to TEMPLATE_NAMES; extras.ts carries a pack's
 * extras stylesheet, which only the Worker can bundle as text.
 */
import sketchManifest from "../../../../packages/ds-sketch/manifest.json" with { type: "json" };
import sketchSemantic from "../../../../packages/ds-sketch/tokens/semantic.json" with { type: "json" };
import sketchSystemDark from "../../../../packages/ds-sketch/tokens/system.dark.json" with { type: "json" };
import sketchSystem from "../../../../packages/ds-sketch/tokens/system.json" with { type: "json" };
import sketchSystemLight from "../../../../packages/ds-sketch/tokens/system.light.json" with { type: "json" };
import wireframeManifest from "../../../../packages/ds-wireframe/manifest.json" with { type: "json" };
import wireframeSemantic from "../../../../packages/ds-wireframe/tokens/semantic.json" with { type: "json" };
import wireframeSystemDark from "../../../../packages/ds-wireframe/tokens/system.dark.json" with { type: "json" };
import wireframeSystem from "../../../../packages/ds-wireframe/tokens/system.json" with { type: "json" };
import wireframeSystemLight from "../../../../packages/ds-wireframe/tokens/system.light.json" with { type: "json" };
import editorialManifest from "../../../../packages/ds-editorial/manifest.json" with { type: "json" };
import editorialSemantic from "../../../../packages/ds-editorial/tokens/semantic.json" with { type: "json" };
import editorialSystemDark from "../../../../packages/ds-editorial/tokens/system.dark.json" with { type: "json" };
import editorialSystem from "../../../../packages/ds-editorial/tokens/system.json" with { type: "json" };
import editorialSystemLight from "../../../../packages/ds-editorial/tokens/system.light.json" with { type: "json" };
import brutalistManifest from "../../../../packages/ds-brutalist/manifest.json" with { type: "json" };
import brutalistSemantic from "../../../../packages/ds-brutalist/tokens/semantic.json" with { type: "json" };
import brutalistSystemDark from "../../../../packages/ds-brutalist/tokens/system.dark.json" with { type: "json" };
import brutalistSystem from "../../../../packages/ds-brutalist/tokens/system.json" with { type: "json" };
import brutalistSystemLight from "../../../../packages/ds-brutalist/tokens/system.light.json" with { type: "json" };
import glassManifest from "../../../../packages/ds-glass/manifest.json" with { type: "json" };
import glassSemantic from "../../../../packages/ds-glass/tokens/semantic.json" with { type: "json" };
import glassSystemDark from "../../../../packages/ds-glass/tokens/system.dark.json" with { type: "json" };
import glassSystem from "../../../../packages/ds-glass/tokens/system.json" with { type: "json" };
import glassSystemLight from "../../../../packages/ds-glass/tokens/system.light.json" with { type: "json" };
import terminalManifest from "../../../../packages/ds-terminal/manifest.json" with { type: "json" };
import terminalSemantic from "../../../../packages/ds-terminal/tokens/semantic.json" with { type: "json" };
import terminalSystemDark from "../../../../packages/ds-terminal/tokens/system.dark.json" with { type: "json" };
import terminalSystem from "../../../../packages/ds-terminal/tokens/system.json" with { type: "json" };
import terminalSystemLight from "../../../../packages/ds-terminal/tokens/system.light.json" with { type: "json" };
import pastelManifest from "../../../../packages/ds-pastel/manifest.json" with { type: "json" };
import pastelSemantic from "../../../../packages/ds-pastel/tokens/semantic.json" with { type: "json" };
import pastelSystemDark from "../../../../packages/ds-pastel/tokens/system.dark.json" with { type: "json" };
import pastelSystem from "../../../../packages/ds-pastel/tokens/system.json" with { type: "json" };
import pastelSystemLight from "../../../../packages/ds-pastel/tokens/system.light.json" with { type: "json" };
import civicManifest from "../../../../packages/ds-civic/manifest.json" with { type: "json" };
import civicSemantic from "../../../../packages/ds-civic/tokens/semantic.json" with { type: "json" };
import civicSystemDark from "../../../../packages/ds-civic/tokens/system.dark.json" with { type: "json" };
import civicSystem from "../../../../packages/ds-civic/tokens/system.json" with { type: "json" };
import civicSystemLight from "../../../../packages/ds-civic/tokens/system.light.json" with { type: "json" };
import financeManifest from "../../../../packages/ds-finance/manifest.json" with { type: "json" };
import financeSemantic from "../../../../packages/ds-finance/tokens/semantic.json" with { type: "json" };
import financeSystemDark from "../../../../packages/ds-finance/tokens/system.dark.json" with { type: "json" };
import financeSystem from "../../../../packages/ds-finance/tokens/system.json" with { type: "json" };
import financeSystemLight from "../../../../packages/ds-finance/tokens/system.light.json" with { type: "json" };
import healthManifest from "../../../../packages/ds-health/manifest.json" with { type: "json" };
import healthSemantic from "../../../../packages/ds-health/tokens/semantic.json" with { type: "json" };
import healthSystemDark from "../../../../packages/ds-health/tokens/system.dark.json" with { type: "json" };
import healthSystem from "../../../../packages/ds-health/tokens/system.json" with { type: "json" };
import healthSystemLight from "../../../../packages/ds-health/tokens/system.light.json" with { type: "json" };
import neonManifest from "../../../../packages/ds-neon/manifest.json" with { type: "json" };
import neonSemantic from "../../../../packages/ds-neon/tokens/semantic.json" with { type: "json" };
import neonSystemDark from "../../../../packages/ds-neon/tokens/system.dark.json" with { type: "json" };
import neonSystem from "../../../../packages/ds-neon/tokens/system.json" with { type: "json" };
import neonSystemLight from "../../../../packages/ds-neon/tokens/system.light.json" with { type: "json" };
import monoManifest from "../../../../packages/ds-mono/manifest.json" with { type: "json" };
import monoSemantic from "../../../../packages/ds-mono/tokens/semantic.json" with { type: "json" };
import monoSystemDark from "../../../../packages/ds-mono/tokens/system.dark.json" with { type: "json" };
import monoSystem from "../../../../packages/ds-mono/tokens/system.json" with { type: "json" };
import monoSystemLight from "../../../../packages/ds-mono/tokens/system.light.json" with { type: "json" };

export interface Manifest {
  name: string;
  displayName?: string;
  version: string;
  contractVersion: string;
  modes: Record<string, string[]>;
  defaultMode: string;
  template?: boolean;
  extras?: string;
  layout?: Record<string, string>;
  provenance?: { source: string; notes?: string }[];
}

export interface TemplatePack {
  manifest: Manifest;
  files: Record<string, Record<string, unknown>>;
}

export const TEMPLATE_PACKS: Record<string, TemplatePack> = {
  sketch: { manifest: sketchManifest as Manifest, files: { "tokens/semantic.json": sketchSemantic, "tokens/system.dark.json": sketchSystemDark, "tokens/system.json": sketchSystem, "tokens/system.light.json": sketchSystemLight } },
  wireframe: { manifest: wireframeManifest as Manifest, files: { "tokens/semantic.json": wireframeSemantic, "tokens/system.dark.json": wireframeSystemDark, "tokens/system.json": wireframeSystem, "tokens/system.light.json": wireframeSystemLight } },
  editorial: { manifest: editorialManifest as Manifest, files: { "tokens/semantic.json": editorialSemantic, "tokens/system.dark.json": editorialSystemDark, "tokens/system.json": editorialSystem, "tokens/system.light.json": editorialSystemLight } },
  brutalist: { manifest: brutalistManifest as Manifest, files: { "tokens/semantic.json": brutalistSemantic, "tokens/system.dark.json": brutalistSystemDark, "tokens/system.json": brutalistSystem, "tokens/system.light.json": brutalistSystemLight } },
  glass: { manifest: glassManifest as Manifest, files: { "tokens/semantic.json": glassSemantic, "tokens/system.dark.json": glassSystemDark, "tokens/system.json": glassSystem, "tokens/system.light.json": glassSystemLight } },
  terminal: { manifest: terminalManifest as Manifest, files: { "tokens/semantic.json": terminalSemantic, "tokens/system.dark.json": terminalSystemDark, "tokens/system.json": terminalSystem, "tokens/system.light.json": terminalSystemLight } },
  pastel: { manifest: pastelManifest as Manifest, files: { "tokens/semantic.json": pastelSemantic, "tokens/system.dark.json": pastelSystemDark, "tokens/system.json": pastelSystem, "tokens/system.light.json": pastelSystemLight } },
  civic: { manifest: civicManifest as Manifest, files: { "tokens/semantic.json": civicSemantic, "tokens/system.dark.json": civicSystemDark, "tokens/system.json": civicSystem, "tokens/system.light.json": civicSystemLight } },
  finance: { manifest: financeManifest as Manifest, files: { "tokens/semantic.json": financeSemantic, "tokens/system.dark.json": financeSystemDark, "tokens/system.json": financeSystem, "tokens/system.light.json": financeSystemLight } },
  health: { manifest: healthManifest as Manifest, files: { "tokens/semantic.json": healthSemantic, "tokens/system.dark.json": healthSystemDark, "tokens/system.json": healthSystem, "tokens/system.light.json": healthSystemLight } },
  neon: { manifest: neonManifest as Manifest, files: { "tokens/semantic.json": neonSemantic, "tokens/system.dark.json": neonSystemDark, "tokens/system.json": neonSystem, "tokens/system.light.json": neonSystemLight } },
  mono: { manifest: monoManifest as Manifest, files: { "tokens/semantic.json": monoSemantic, "tokens/system.dark.json": monoSystemDark, "tokens/system.json": monoSystem, "tokens/system.light.json": monoSystemLight } },
};

/** In the order the chooser shows them: the plainest starts first, the strongest characters after. */
export const TEMPLATE_NAMES = ["mono", "civic", "sketch", "wireframe", "editorial", "pastel", "health", "finance", "glass", "terminal", "brutalist", "neon"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/** The one line the pack's provenance gives it: "Hand-drawn: paper, ink, …". */
export function characterOf(manifest: Manifest): string {
  const notes = manifest.provenance?.map((p) => p.notes ?? "").find((n) => /^Original template/.test(n)) ?? "";
  const m = /^Original template by Polyxd:\s*(.+?)(?:\s+Not derived|$)/s.exec(notes);
  return (m?.[1] ?? notes).trim().replace(/\.$/, "");
}

export const isTemplateName = (s: unknown): s is TemplateName => typeof s === "string" && (TEMPLATE_NAMES as readonly string[]).includes(s);
