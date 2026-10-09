/**
 * The server's MCP prompts: ready-made asks a person picks from a menu instead of knowing what to
 * type. Claude Code lists them as slash commands (/mcp__polyxd__screen), Claude and other hosts in
 * their prompt or attachment menus. Each one is only a user message: it asks the model to use the
 * tools as the instructions already say, so a prompt never changes what a tool does.
 *
 * Every argument is a string (prompt arguments always are) and optional unless the ask makes no
 * sense without it.
 */
import { fromJsonSchema } from "@modelcontextprotocol/server";

export interface PromptDef {
  name: string;
  title: string;
  description: string;
  args: { name: string; description: string; required?: boolean }[];
  /** The user message, from the arguments the person filled in. */
  text: (args: Record<string, string | undefined>) => string;
}

const pack = (p?: string) => (p?.trim() ? ` Draw it in ${p.trim()}.` : "");

export const PROMPTS: PromptDef[] = [
  {
    name: "screen",
    title: "Show it as a screen",
    description: "Ask for something as an interactive screen in the chat (a form, a review, a comparison, a dashboard) instead of a wall of text.",
    args: [
      { name: "what", description: "What the screen is for, e.g. \"split a $168 dinner bill between four friends\".", required: true },
      { name: "pack", description: "A design system, e.g. Material 3, Carbon, GOV.UK or shadcn/ui. Leave blank for the default." },
    ],
    text: ({ what, pack: p }) =>
      `Show me this as an interactive screen with Polyxd, not as text: ${what?.trim()}.${pack(p)} Use only the numbers and details I've given; ask me for anything you'd otherwise have to make up.`,
  },
  {
    name: "as-screen",
    title: "Turn your last answer into a screen",
    description: "Turn the assistant's last answer into an interactive screen, with the choices or fields it asked about as controls.",
    args: [{ name: "pack", description: "A design system, e.g. Material 3, Carbon, GOV.UK or shadcn/ui. Leave blank for the default." }],
    text: ({ pack: p }) =>
      `Turn your last answer into an interactive Polyxd screen: the choices, fields and figures in it as real controls, with one clear button for what I'd do next.${pack(p)} Keep every number exactly as you gave it.`,
  },
  {
    name: "compare",
    title: "Compare options side by side",
    description: "Compare a few options as a screen with a clear choice, instead of paragraphs of pros and cons.",
    args: [
      { name: "options", description: "What to compare, e.g. \"three broadband plans: …\" or \"the laptops we just discussed\".", required: true },
      { name: "pack", description: "A design system. Leave blank for the default." },
    ],
    text: ({ options, pack: p }) =>
      `Compare these as a Polyxd screen I can choose from, with the differences that matter side by side and a button to pick one: ${options?.trim()}.${pack(p)} Use only facts from our conversation; leave out anything you'd have to guess.`,
  },
  {
    name: "add-to-app",
    title: "Add Polyxd to my app",
    description: "Add Polyxd's renderer, validator and verifier to the codebase you're working in, following the current docs.",
    args: [{ name: "framework", description: "React, Web Components, or leave blank to detect it from the project." }],
    text: ({ framework }) =>
      `Add Polyxd to this project${framework?.trim() ? ` using ${framework.trim()}` : ""}: render documents, validate them, and run the verifier in CI. Look up each step with polyxd_docs first and cite the pages; don't install anything I haven't agreed to.`,
  },
];

/** A prompt's arguments as the JSON Schema the SDK advertises in prompts/list. */
export function argsSchema(def: PromptDef) {
  return fromJsonSchema<Record<string, string | undefined>>({
    type: "object",
    properties: Object.fromEntries(def.args.map((a) => [a.name, { type: "string", description: a.description }])),
    required: def.args.filter((a) => a.required).map((a) => a.name),
  });
}
