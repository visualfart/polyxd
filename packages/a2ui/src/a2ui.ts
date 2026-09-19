/**
 * Constants for the A2UI target and loaders for the vendored official schemas.
 * See vendor/a2ui/<version>/README.md for provenance.
 */
import { readFileSync } from "node:fs";

/** Value of the `version` field on every emitted message. */
export const A2UI_VERSION = "v1.0";
/** Commit of a2ui-project/a2ui the vendored schemas were taken from. */
export const A2UI_COMMIT = "04e6f07fde12ff2638b3b489bd9e3033066cb957";
/** `catalogId` (and `$id`) of the Polixd A2UI catalog. */
export const POLIXD_CATALOG_ID = "https://polixd.dev/catalog/0.1/a2ui";
/** `catalogId` of the official Basic catalog (for reference; the exporter does not emit Basic components). */
export const BASIC_CATALOG_ID = "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";
/**
 * Key under `metadata.extensions` for Polixd metadata that has no A2UI equivalent.
 * Third-party extension keys must be prefixed with an organisation id (A2UI v1.0 §Extensions); this is polixd.dev reversed.
 */
export const EXTENSION_KEY = "dev_polixd";

const VENDOR_DIR = new URL("../vendor/a2ui/v1_0-04e6f07/", import.meta.url);

export type Json = Record<string, any>;

export const loadVendored = (path: string): Json => JSON.parse(readFileSync(new URL(path, VENDOR_DIR), "utf8"));

/** The official schemas the exporter is checked against. */
export const a2uiSchemas = {
  agentToRenderer: () => loadVendored("json/agent_to_renderer.json"),
  commonTypes: () => loadVendored("json/common_types.json"),
  catalogDefinition: () => loadVendored("json/catalog_definition.json"),
  basicCatalog: () => loadVendored("catalogs/basic/catalog.json"),
};
