/**
 * Writes catalog/catalog.json: the Polyxd catalog in A2UI v1.0 catalog format, generated from
 * @polyxd/spec components/*.json. Run with `npm run build:catalog`. The tests fail if the file is stale
 * or does not validate against the official A2UI catalog-definition schema.
 */
import { writeFileSync } from "node:fs";
import { CATALOG_FILE, catalogJson } from "../src/catalog.ts";

writeFileSync(CATALOG_FILE, catalogJson());
console.log(`wrote ${CATALOG_FILE.pathname}`);
