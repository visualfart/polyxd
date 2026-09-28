/**
 * What the server serves from @polyxd/spec: the component definitions, the example documents and
 * the example Design Directions. They arrive as JSON modules (src/spec-files.generated.ts), not
 * from the file system, so the same code runs in Node and in a Cloudflare Worker.
 */
import { COMPONENT_FILES, DIRECTION_FILES, EXAMPLE_FILES } from "./spec-files.generated.ts";

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

let components: ComponentDefinition[] | undefined;
export function componentDefinitions(): ComponentDefinition[] {
  return (components ??= COMPONENT_FILES.map(([, json]) => json as ComponentDefinition));
}

export function componentNamed(name: string): ComponentDefinition | undefined {
  const lower = name.toLowerCase();
  return componentDefinitions().find((c) => c.name.toLowerCase() === lower);
}

const text = (json: unknown) => `${JSON.stringify(json, null, 2)}\n`;

let examples: Example[] | undefined;
/** The spec's example UI documents, served as polyxd://examples/<name>.json. */
export function exampleDocuments(): Example[] {
  return (examples ??= EXAMPLE_FILES.map(([f, json]) => {
    const doc = json as any;
    const name = f.replace(/\.json$/, "");
    const kind = doc.surface?.kind === "shell" ? "shell" : "surface";
    return {
      name,
      uri: `polyxd://examples/${f}`,
      title: doc.surface?.title ?? name,
      description: `Example Polyxd UI document (${kind}${doc.surface?.pattern ? `, ${doc.surface.pattern} pattern` : ""}${doc.surface?.intent ? `, intent ${doc.surface.intent}` : ""}).`,
      json: text(doc),
    };
  }));
}

let directions: Example[] | undefined;
/** The spec's example Design Directions, served as polyxd://directions/<name>.json and accepted by name by polyxd_verify. */
export function exampleDirections(): Example[] {
  return (directions ??= DIRECTION_FILES.map(([f, json]) => {
    const name = f.replace(/\.json$/, "");
    return { name, uri: `polyxd://directions/${f}`, title: name, description: "Example Design Direction: the voice, rules and emphasis budget a product holds its screens to.", json: text(json) };
  }));
}
