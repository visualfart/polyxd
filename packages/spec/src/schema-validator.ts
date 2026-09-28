/**
 * The shape of the spec's schema validators. They are compiled ahead of time with Ajv's standalone
 * output (scripts/build-validators.ts), so they carry no compiler and generate no code at run time:
 * they work under a content security policy and in Cloudflare Workers. These types describe them
 * without depending on Ajv, which the package needs only to build them.
 */

/** One schema error, as Ajv reports it. */
export interface SchemaError {
  /** JSON Pointer to the value that failed */
  instancePath: string;
  /** JSON Pointer to the schema keyword that failed */
  schemaPath: string;
  keyword: string;
  params: Record<string, any>;
  message?: string;
  propertyName?: string;
  /** The failing value; Ajv sets it only when compiled with `verbose`, which the spec's validators aren't */
  data?: unknown;
}

/** A compiled schema: call it with a value; when it returns false, `errors` says why. */
export interface SchemaValidator {
  (data: unknown): boolean;
  errors?: SchemaError[] | null;
}
