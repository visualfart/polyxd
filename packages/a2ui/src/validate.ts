/**
 * Validation against the vendored official A2UI v1.0 schemas.
 *
 * `agent_to_renderer.json` refers to the active catalog as `catalog.json#/$defs/anyComponent`, resolved
 * against its own $id. As in the upstream test runner (specification/v1_0/test/run_tests.py), the catalog in
 * use is registered under `https://a2ui.org/specification/v1_0/catalog.json`, so its relative
 * `common_types.json#/...` references resolve to the official common types.
 */
import { Ajv2020, type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";
import { a2uiSchemas, type Json } from "./a2ui.ts";
import { loadPolyxdCatalog } from "./catalog.ts";

const CATALOG_ALIAS = "https://a2ui.org/specification/v1_0/catalog.json";
const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => Ajv2020;

export interface A2UIValidationError {
  at: string;
  message: string;
}

const describe = (errors: ErrorObject[] | null | undefined): A2UIValidationError[] =>
  (errors ?? []).map((e) => ({ at: e.instancePath || "/", message: `${e.message ?? e.keyword} ${JSON.stringify(e.params)}` }));

/** Settings match the upstream runner: `ajv validate --spec=draft2020 --strict=false -c ajv-formats`. */
const newAjv = () => addFormats(new Ajv2020({ strict: false, allErrors: true }));

export interface A2UIValidator {
  /** Validates one agent-to-renderer message against agent_to_renderer.json with `catalog` as the active catalog. */
  message(msg: unknown): A2UIValidationError[];
  /** Validates a catalog document against catalog_definition.json. */
  catalogDefinition(catalog: unknown): A2UIValidationError[];
}

export function createValidator(catalog: Json = loadPolyxdCatalog()): A2UIValidator {
  const ajv = newAjv();
  ajv.addSchema(a2uiSchemas.commonTypes());
  ajv.addSchema({ ...catalog, $id: CATALOG_ALIAS });
  const catalogDefinition = a2uiSchemas.catalogDefinition();
  ajv.addSchema(catalogDefinition);
  const message: ValidateFunction = ajv.compile(a2uiSchemas.agentToRenderer());
  const definition = ajv.getSchema(catalogDefinition.$id)!;
  return {
    message: (msg) => (message(msg) ? [] : describe(message.errors)),
    catalogDefinition: (c) => (definition(c) ? [] : describe(definition.errors)),
  };
}

/**
 * Checks the component tree the way A2UI validators do. Structural links are found through the catalog's
 * `ComponentId` / `ChildList` references. It checks that exactly one component is `root`, ids are unique, and
 * every reference resolves. `allowedChildren` constraints are checked too.
 */
export function checkComponentTree(components: Json[], catalog: Json = loadPolyxdCatalog()): A2UIValidationError[] {
  const errors: A2UIValidationError[] = [];
  const byId = new Map<string, Json>();
  components.forEach((c, i) => {
    if (byId.has(c.id)) errors.push({ at: `/${i}/id`, message: `duplicate id "${c.id}"` });
    byId.set(c.id, c);
  });
  if (!byId.has("root")) errors.push({ at: "/", message: 'no component with id "root"' });

  const refsOf = (schema: Json | undefined, value: unknown, at: string, out: { id: string; at: string }[]) => {
    if (!schema || value === undefined) return;
    const ref: string | undefined = schema.$ref;
    if (ref?.endsWith("/ComponentId") && typeof value === "string") return void out.push({ id: value, at });
    if (ref?.endsWith("/ChildList")) {
      if (Array.isArray(value)) value.forEach((id, i) => out.push({ id, at: `${at}/${i}` }));
      else if (value && typeof value === "object") out.push({ id: (value as Json).componentId, at: `${at}/componentId` });
      return;
    }
    if (Array.isArray(value) && schema.items) value.forEach((v, i) => refsOf(schema.items, v, `${at}/${i}`, out));
    else if (value && typeof value === "object" && schema.properties) {
      for (const [k, v] of Object.entries(value)) refsOf(schema.properties[k], v, `${at}/${k}`, out);
    }
  };

  components.forEach((c, i) => {
    const def = catalog.components?.[c.component];
    if (!def) return void errors.push({ at: `/${i}/component`, message: `"${c.component}" is not in catalog ${catalog.catalogId}` });
    const refs: { id: string; at: string }[] = [];
    refsOf(def, c, `/${i}`, refs);
    for (const r of refs) {
      const target = byId.get(r.id);
      if (!target) errors.push({ at: r.at, message: `references unknown component "${r.id}"` });
      else if (def.allowedChildren && !def.allowedChildren.includes(target.component)) {
        errors.push({ at: r.at, message: `UNALLOWED_CHILD: ${c.component} cannot contain ${target.component}` });
      }
    }
  });
  return errors;
}
