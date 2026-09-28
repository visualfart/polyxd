import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Capability, Direction, GenerateRequest, Generator, UIDocument } from "../src/index.ts";

const SPEC = new URL("../../spec/", import.meta.url);
export const readSpec = (path: string) => JSON.parse(readFileSync(new URL(path, SPEC), "utf8"));
export const calmFinance = (): Direction => readSpec("examples/directions/calm-finance.json");
export const playfulPersonal = (): Direction => readSpec("examples/directions/playful-personal.json");
export const halden = (): Direction => JSON.parse(readFileSync(new URL("../../../apps/demos/halden/direction.json", import.meta.url), "utf8"));
/** Resolves a calm-finance exemplar path the way a Node host would. */
export const resolveFromDirections = (path: string) => JSON.parse(readFileSync(new URL(path, new URL("examples/directions/", SPEC)), "utf8"));

/**
 * Compares text with a file under test/snapshots. `UPDATE_SNAPSHOTS=1` writes it instead; a
 * missing snapshot fails, so a new one is always looked at before it's committed.
 */
export function snapshot(name: string, actual: string): void {
  const file = new URL(`./snapshots/${name}`, import.meta.url);
  if (process.env.UPDATE_SNAPSHOTS) {
    writeFileSync(file, actual);
    return;
  }
  assert.ok(existsSync(file), `no snapshot ${name}; run with UPDATE_SNAPSHOTS=1 and check the file`);
  assert.equal(actual, readFileSync(file, "utf8"), `snapshot ${name} changed; run with UPDATE_SNAPSHOTS=1 to accept`);
}

export const capabilities: Record<string, Capability> = {
  "transfer.confirm": {
    description: "Send money for a reviewed quote",
    risk: "consequential",
    inputs: { properties: { quoteId: { type: "string" } }, required: ["quoteId"] },
  },
};

/** The data the confirmation is shown with. */
export const data = readSpec("examples/money-send-confirm.json").data;

/** A confirmation that passes every check under calm-finance, with `data`. */
export function confirmDoc(): UIDocument {
  const doc = readSpec("examples/money-send-confirm.json");
  delete doc.data;
  delete doc.$schema;
  return doc;
}

/** The same confirmation with a summary that points at nothing: a structural error. */
export function brokenDoc(): UIDocument {
  const doc = confirmDoc();
  (doc.components[0] as any).summary = "missing";
  return doc;
}

export interface Fake extends Generator {
  requests: GenerateRequest[];
}

/**
 * A generator that answers from a script, streaming each answer in small pieces. An answer that's a
 * function runs instead (to throw, or to wait for an abort).
 */
export function fake(answers: (string | ((req: GenerateRequest) => Promise<string> | string))[], options: { chunk?: number; stream?: boolean; usage?: boolean } = {}): Fake {
  const requests: GenerateRequest[] = [];
  let i = 0;
  return {
    name: "fake",
    requests,
    async generate(req) {
      requests.push(structuredClone({ system: req.system, messages: req.messages }));
      const a = answers[Math.min(i++, answers.length - 1)];
      const text = typeof a === "function" ? await a(req) : a;
      if (options.stream !== false) for (let k = 0; k < text.length; k += options.chunk ?? 40) req.onText?.(text.slice(k, k + (options.chunk ?? 40)));
      return options.usage === false ? text : { text, usage: { inputTokens: 100, outputTokens: text.length } };
    },
  };
}

export const fenced = (doc: unknown) => "Here is the screen:\n```json\n" + JSON.stringify(doc, null, 2) + "\n```\n";
