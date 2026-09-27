/**
 * A pack's extras stylesheet (what tokens can't express: the Sketch pack's uneven radii, the
 * Wireframe's dashed borders), bundled as text. Worker-only: wrangler's rule for *.css makes
 * these strings, and nothing else imports this file, so tests and the app never load CSS as code.
 */
import sketch from "../../../../packages/ds-sketch/tokens/extras.css";
import wireframe from "../../../../packages/ds-wireframe/tokens/extras.css";

// Vite's types call a CSS import a stylesheet module; under wrangler's Text rule it is the file's text.
export const TEMPLATE_EXTRAS: Record<string, string> = { sketch: sketch as unknown as string, wireframe: wireframe as unknown as string };
