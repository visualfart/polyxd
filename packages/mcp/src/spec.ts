/**
 * What the server reads from @polyxd/spec's published files: the component definitions, the
 * example documents and the example Design Directions. Read once, on first use.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const SPEC_DIR = dirname(createRequire(import.meta.url).resolve("@polyxd/spec/package.json"));

export interface ComponentDefinition {
  name: string;
  category: string;
  summary: string;
  props: Record<string, unknown>;
  required: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  /** Shell components frame a product's screens: authored once, never generated. */
  shell?: boolean;
  [key: string]: unknown;
}

export interface Example {
  /** File name without .json, e.g. "tasks-add" */
  name: string;
  uri: string;
  title: string;
  description: string;
  json: string;
}

const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const jsonFiles = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).sort() : []);

let components: ComponentDefinition[] | undefined;
export function componentDefinitions(): ComponentDefinition[] {
  return (components ??= jsonFiles(join(SPEC_DIR, "components")).map((f) => readJson(join(SPEC_DIR, "components", f))));
}

export function componentNamed(name: string): ComponentDefinition | undefined {
  const lower = name.toLowerCase();
  return componentDefinitions().find((c) => c.name.toLowerCase() === lower);
}

let examples: Example[] | undefined;
/** The spec's example UI documents, served as polyxd://examples/<name>.json. */
export function exampleDocuments(): Example[] {
  return (examples ??= jsonFiles(join(SPEC_DIR, "examples")).map((f) => {
    const json = readFileSync(join(SPEC_DIR, "examples", f), "utf8");
    const doc = JSON.parse(json);
    const name = f.replace(/\.json$/, "");
    const kind = doc.surface?.kind === "shell" ? "shell" : "surface";
    return {
      name,
      uri: `polyxd://examples/${f}`,
      title: doc.surface?.title ?? name,
      description: `Example Polyxd UI document (${kind}${doc.surface?.pattern ? `, ${doc.surface.pattern} pattern` : ""}${doc.surface?.intent ? `, intent ${doc.surface.intent}` : ""}).`,
      json,
    };
  }));
}

let directions: Example[] | undefined;
/** The spec's example Design Directions, served as polyxd://directions/<name>.json and accepted by name by polyxd_verify. */
export function exampleDirections(): Example[] {
  return (directions ??= jsonFiles(join(SPEC_DIR, "examples", "directions")).map((f) => {
    const json = readFileSync(join(SPEC_DIR, "examples", "directions", f), "utf8");
    const name = f.replace(/\.json$/, "");
    return { name, uri: `polyxd://directions/${f}`, title: name, description: "Example Design Direction: the voice, rules and emphasis budget a product holds its screens to.", json };
  }));
}
