// Dumps Ant Design's computed design tokens for the default and dark algorithms.
// Vendored by @polyxd/ds-antd; the output is scripts/sources/antd/antd-tokens.json.
// Run in a scratch directory (not in the Polyxd repo) with: npm install antd@6.6.4 react react-dom && node dump-antd-tokens.mjs > antd-tokens.json
import { createRequire } from "node:module";
import { theme } from "antd";
import * as colors from "@ant-design/colors";

const require = createRequire(import.meta.url);
const pkgVersion = (name) => require(`${name}/package.json`).version;

const seed = theme.defaultSeed ?? theme.defaultConfig?.token;
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const pick = (o) => sortKeys(Object.fromEntries(Object.entries(o).filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean")));

const out = {
  versions: { antd: pkgVersion("antd"), "@ant-design/colors": pkgVersion("@ant-design/colors") },
  seed: pick(seed),
  map: {
    light: pick(theme.defaultAlgorithm(seed)),
    dark: pick(theme.darkAlgorithm(seed)),
  },
  alias: {
    light: pick(theme.getDesignToken({ algorithm: theme.defaultAlgorithm })),
    dark: pick(theme.getDesignToken({ algorithm: theme.darkAlgorithm })),
  },
  presetPalettes: Object.fromEntries(Object.entries(colors.presetPalettes).map(([k, v]) => [k, [...v]])),
  presetDarkPalettes: Object.fromEntries(Object.entries(colors.presetDarkPalettes).map(([k, v]) => [k, [...v]])),
  presetPrimaryColors: { ...colors.presetPrimaryColors },
  // The palettes antd's algorithms derive from each colour seed: generate(seed) for
  // defaultAlgorithm, generate(seed, { theme: "dark" }) for darkAlgorithm.
  seedPalettes: Object.fromEntries(
    ["colorPrimary", "colorSuccess", "colorWarning", "colorError", "colorInfo"].map((key) => [
      key,
      { seed: seed[key], light: [...colors.generate(seed[key])], dark: [...colors.generate(seed[key], { theme: "dark" })] },
    ]),
  ),
};
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
