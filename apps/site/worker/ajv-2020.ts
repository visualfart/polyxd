// @ts-expect-error: generated at build time by scripts/build-validator.ts, and not committed.
import validate, { schemaId } from "./ui-validate.generated.js";

/**
 * Workers can't compile code at runtime, and Ajv compiles every schema into a function. The Worker
 * bundle aliases "ajv/dist/2020.js" to this file (wrangler.jsonc), and this class hands back the UI
 * document schema's validator, compiled ahead of time with the options the spec uses. It is the only
 * schema the Worker's code compiles (the spec's validate.ts, reached through @polyxd/runtime).
 */
export class Ajv2020 {
  constructor(_options?: unknown) {}
  compile(schema: { $id?: string }) {
    if (schema?.$id !== schemaId) throw new Error(`Only ${schemaId} is precompiled for the Worker`);
    return validate;
  }
}
