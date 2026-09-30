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

// The thirteen packs modelled on published design systems. Starting from one copies its tokens
// into the workspace; from then on the copy is the team's own, and the pack is not read again.
import material3Manifest from "../../../../packages/ds-material3/manifest.json" with { type: "json" };
import material3Primitive from "../../../../packages/ds-material3/tokens/primitive.json" with { type: "json" };
import material3Semantic from "../../../../packages/ds-material3/tokens/semantic.json" with { type: "json" };
import material3SystemDark from "../../../../packages/ds-material3/tokens/system.dark.json" with { type: "json" };
import material3System from "../../../../packages/ds-material3/tokens/system.json" with { type: "json" };
import material3SystemLight from "../../../../packages/ds-material3/tokens/system.light.json" with { type: "json" };
import carbonManifest from "../../../../packages/ds-carbon/manifest.json" with { type: "json" };
import carbonPrimitive from "../../../../packages/ds-carbon/tokens/primitive.json" with { type: "json" };
import carbonSemantic from "../../../../packages/ds-carbon/tokens/semantic.json" with { type: "json" };
import carbonSystemDark from "../../../../packages/ds-carbon/tokens/system.dark.json" with { type: "json" };
import carbonSystem from "../../../../packages/ds-carbon/tokens/system.json" with { type: "json" };
import carbonSystemLight from "../../../../packages/ds-carbon/tokens/system.light.json" with { type: "json" };
import antdManifest from "../../../../packages/ds-antd/manifest.json" with { type: "json" };
import antdPrimitive from "../../../../packages/ds-antd/tokens/primitive.json" with { type: "json" };
import antdSemantic from "../../../../packages/ds-antd/tokens/semantic.json" with { type: "json" };
import antdSystemDark from "../../../../packages/ds-antd/tokens/system.dark.json" with { type: "json" };
import antdSystem from "../../../../packages/ds-antd/tokens/system.json" with { type: "json" };
import antdSystemLight from "../../../../packages/ds-antd/tokens/system.light.json" with { type: "json" };
import fluentManifest from "../../../../packages/ds-fluent/manifest.json" with { type: "json" };
import fluentSemantic from "../../../../packages/ds-fluent/tokens/semantic.json" with { type: "json" };
import fluentSystemDark from "../../../../packages/ds-fluent/tokens/system.dark.json" with { type: "json" };
import fluentSystemLight from "../../../../packages/ds-fluent/tokens/system.light.json" with { type: "json" };
import shadcnManifest from "../../../../packages/ds-shadcn/manifest.json" with { type: "json" };
import shadcnSemantic from "../../../../packages/ds-shadcn/tokens/semantic.json" with { type: "json" };
import shadcnSystemDark from "../../../../packages/ds-shadcn/tokens/system.dark.json" with { type: "json" };
import shadcnSystem from "../../../../packages/ds-shadcn/tokens/system.json" with { type: "json" };
import shadcnSystemLight from "../../../../packages/ds-shadcn/tokens/system.light.json" with { type: "json" };
import bootstrapManifest from "../../../../packages/ds-bootstrap/manifest.json" with { type: "json" };
import bootstrapSemantic from "../../../../packages/ds-bootstrap/tokens/semantic.json" with { type: "json" };
import bootstrapSystemDark from "../../../../packages/ds-bootstrap/tokens/system.dark.json" with { type: "json" };
import bootstrapSystemLight from "../../../../packages/ds-bootstrap/tokens/system.light.json" with { type: "json" };
import mantineManifest from "../../../../packages/ds-mantine/manifest.json" with { type: "json" };
import mantineSemantic from "../../../../packages/ds-mantine/tokens/semantic.json" with { type: "json" };
import mantineSystemDark from "../../../../packages/ds-mantine/tokens/system.dark.json" with { type: "json" };
import mantineSystemLight from "../../../../packages/ds-mantine/tokens/system.light.json" with { type: "json" };
import radixManifest from "../../../../packages/ds-radix/manifest.json" with { type: "json" };
import radixSemantic from "../../../../packages/ds-radix/tokens/semantic.json" with { type: "json" };
import radixSystemDark from "../../../../packages/ds-radix/tokens/system.dark.json" with { type: "json" };
import radixSystemLight from "../../../../packages/ds-radix/tokens/system.light.json" with { type: "json" };
import polarisManifest from "../../../../packages/ds-polaris/manifest.json" with { type: "json" };
import polarisSemantic from "../../../../packages/ds-polaris/tokens/semantic.json" with { type: "json" };
import polarisSystemDark from "../../../../packages/ds-polaris/tokens/system.dark.json" with { type: "json" };
import polarisSystemLight from "../../../../packages/ds-polaris/tokens/system.light.json" with { type: "json" };
import primerManifest from "../../../../packages/ds-primer/manifest.json" with { type: "json" };
import primerSemantic from "../../../../packages/ds-primer/tokens/semantic.json" with { type: "json" };
import primerSystemDark from "../../../../packages/ds-primer/tokens/system.dark.json" with { type: "json" };
import primerSystem from "../../../../packages/ds-primer/tokens/system.json" with { type: "json" };
import primerSystemLight from "../../../../packages/ds-primer/tokens/system.light.json" with { type: "json" };
import spectrumManifest from "../../../../packages/ds-spectrum/manifest.json" with { type: "json" };
import spectrumSemantic from "../../../../packages/ds-spectrum/tokens/semantic.json" with { type: "json" };
import spectrumSystemDark from "../../../../packages/ds-spectrum/tokens/system.dark.json" with { type: "json" };
import spectrumSystemLight from "../../../../packages/ds-spectrum/tokens/system.light.json" with { type: "json" };
import govukManifest from "../../../../packages/ds-govuk/manifest.json" with { type: "json" };
import govukSemantic from "../../../../packages/ds-govuk/tokens/semantic.json" with { type: "json" };
import govukSystemLight from "../../../../packages/ds-govuk/tokens/system.light.json" with { type: "json" };
import chakraManifest from "../../../../packages/ds-chakra/manifest.json" with { type: "json" };
import chakraSemantic from "../../../../packages/ds-chakra/tokens/semantic.json" with { type: "json" };
import chakraSystemDark from "../../../../packages/ds-chakra/tokens/system.dark.json" with { type: "json" };
import chakraSystemLight from "../../../../packages/ds-chakra/tokens/system.light.json" with { type: "json" };

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
  material3: { manifest: material3Manifest as Manifest, files: { "tokens/primitive.json": material3Primitive, "tokens/semantic.json": material3Semantic, "tokens/system.dark.json": material3SystemDark, "tokens/system.json": material3System, "tokens/system.light.json": material3SystemLight } },
  carbon: { manifest: carbonManifest as Manifest, files: { "tokens/primitive.json": carbonPrimitive, "tokens/semantic.json": carbonSemantic, "tokens/system.dark.json": carbonSystemDark, "tokens/system.json": carbonSystem, "tokens/system.light.json": carbonSystemLight } },
  antd: { manifest: antdManifest as Manifest, files: { "tokens/primitive.json": antdPrimitive, "tokens/semantic.json": antdSemantic, "tokens/system.dark.json": antdSystemDark, "tokens/system.json": antdSystem, "tokens/system.light.json": antdSystemLight } },
  fluent: { manifest: fluentManifest as Manifest, files: { "tokens/semantic.json": fluentSemantic, "tokens/system.dark.json": fluentSystemDark, "tokens/system.light.json": fluentSystemLight } },
  shadcn: { manifest: shadcnManifest as Manifest, files: { "tokens/semantic.json": shadcnSemantic, "tokens/system.dark.json": shadcnSystemDark, "tokens/system.json": shadcnSystem, "tokens/system.light.json": shadcnSystemLight } },
  bootstrap: { manifest: bootstrapManifest as Manifest, files: { "tokens/semantic.json": bootstrapSemantic, "tokens/system.dark.json": bootstrapSystemDark, "tokens/system.light.json": bootstrapSystemLight } },
  mantine: { manifest: mantineManifest as Manifest, files: { "tokens/semantic.json": mantineSemantic, "tokens/system.dark.json": mantineSystemDark, "tokens/system.light.json": mantineSystemLight } },
  radix: { manifest: radixManifest as Manifest, files: { "tokens/semantic.json": radixSemantic, "tokens/system.dark.json": radixSystemDark, "tokens/system.light.json": radixSystemLight } },
  polaris: { manifest: polarisManifest as Manifest, files: { "tokens/semantic.json": polarisSemantic, "tokens/system.dark.json": polarisSystemDark, "tokens/system.light.json": polarisSystemLight } },
  primer: { manifest: primerManifest as Manifest, files: { "tokens/semantic.json": primerSemantic, "tokens/system.dark.json": primerSystemDark, "tokens/system.json": primerSystem, "tokens/system.light.json": primerSystemLight } },
  spectrum: { manifest: spectrumManifest as Manifest, files: { "tokens/semantic.json": spectrumSemantic, "tokens/system.dark.json": spectrumSystemDark, "tokens/system.light.json": spectrumSystemLight } },
  govuk: { manifest: govukManifest as Manifest, files: { "tokens/semantic.json": govukSemantic, "tokens/system.light.json": govukSystemLight } },
  chakra: { manifest: chakraManifest as Manifest, files: { "tokens/semantic.json": chakraSemantic, "tokens/system.dark.json": chakraSystemDark, "tokens/system.light.json": chakraSystemLight } },
};

/** In the order the chooser shows them: the plainest starts first, the strongest characters after. */
export const TEMPLATE_NAMES = [
  // Polyxd's own, plainest first.
  "mono", "civic", "sketch", "wireframe", "editorial", "pastel", "health", "finance", "glass", "terminal", "brutalist", "neon",
  // Modelled on published design systems, for a team whose product already uses one. shadcn is
  // not among them yet: five of its tokens carry shadcn's own `var(--surface)` CSS instead of an
  // alias, so a copy would land in a workspace with broken aliases showing.
  "material3", "carbon", "fluent", "antd", "bootstrap", "mantine", "radix", "polaris", "primer", "spectrum", "chakra", "govuk",
] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

/**
 * The one line under a template's name. Polyxd's own packs carry it in their provenance
 * ("Hand-drawn: paper, ink, …"); the packs modelled on a published design system say whose tokens
 * they are and where they came from, because that is the thing a team picking one needs to know.
 */
const MODELLED: Record<string, string> = {
  material3: "Google's Material 3: its palette and type scale, as published",
  carbon: "IBM Carbon: square corners, IBM Plex Sans, full-width actions",
  fluent: "Microsoft Fluent 2: Segoe UI, soft depth",
  shadcn: "shadcn/ui on Tailwind CSS: the default zinc theme",
  antd: "Ant Design: dense, businesslike, Ant's blue",
  bootstrap: "Bootstrap 5: the framework most products already have",
  mantine: "Mantine 8: rounded, roomy, Inter",
  radix: "Radix Themes: WorkOS's indigo scale",
  polaris: "Shopify Polaris: Inter, admin-scale density",
  primer: "GitHub Primer: Mona Sans, tight controls",
  spectrum: "Adobe Spectrum 2: Source Sans, precise spacing",
  chakra: "Chakra UI 3: Inter, generous radii",
  govuk: "GOV.UK Frontend: one theme, no dark mode, plain and accessible",
};

export function characterOf(manifest: Manifest): string {
  const modelled = MODELLED[manifest.name];
  if (modelled) return modelled;
  const notes = manifest.provenance?.map((p) => p.notes ?? "").find((n) => /^Original template/.test(n)) ?? "";
  const m = /^Original template by Polyxd:\s*(.+?)(?:\s+Not derived|$)/s.exec(notes);
  return (m?.[1] ?? notes).trim().replace(/\.$/, "");
}

export const isTemplateName = (s: unknown): s is TemplateName => typeof s === "string" && (TEMPLATE_NAMES as readonly string[]).includes(s);
