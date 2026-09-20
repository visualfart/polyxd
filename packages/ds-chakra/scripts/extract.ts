#!/usr/bin/env node
/**
 * Emits the vendored source for @polyxd/ds-chakra.
 *
 *   node scripts/extract.ts <node_modules>   →  scripts/sources/chakra/tokens.css
 *
 * Chakra publishes its theme as JavaScript rather than as CSS or JSON, so there is nothing to
 * vendor directly. What there is, is Chakra's own emitter: `defaultSystem.getTokenCss()` returns
 * exactly the custom properties a Chakra app ships. This script writes that out, unchanged, so the
 * pack's generator reads a stylesheet like every other pack and the vendored file is reproducible.
 *
 * Install the pinned package somewhere OUTSIDE the monorepo:
 *   cd "$(mktemp -d)" && npm init -y && npm install --ignore-scripts @chakra-ui/react@3.37.0
 * and pass that directory's node_modules.
 */
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const root = resolve(process.argv[2] ?? "");
if (!process.argv[2]) throw new Error("usage: node scripts/extract.ts <node_modules>");
const require = createRequire(join(root, "index.cjs"));
const { defaultSystem } = require("@chakra-ui/react");
const { version } = require("@chakra-ui/react/package.json");

const layers = defaultSystem.getTokenCss()["@layer tokens"] as Record<string, Record<string, string>>;
const block = (selector: string, declarations: Record<string, string>) =>
  `${selector} {\n${Object.entries(declarations)
    .map(([name, value]) => `  ${name}: ${String(value).trim()};`)
    .join("\n")}\n}`;

const css = [
  `/* Emitted by @chakra-ui/react ${version}'s own defaultSystem.getTokenCss(), by scripts/extract.ts. Do not edit. */`,
  ...Object.entries(layers).map(([selector, declarations]) => block(selector, declarations)),
].join("\n\n");

const out = join(dirname(fileURLToPath(import.meta.url)), "sources/chakra/tokens.css");
await writeFile(out, css + "\n");
console.log(`wrote ${out} from @chakra-ui/react ${version}`);
