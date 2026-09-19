/** Version of the Polyxd spec that documents produced by this package conform to. */
export const SPEC_VERSION = "0.1.0";

export { validateDocument, uiSchema, type Issue, type ValidationResult } from "./validate.ts";
export { loadContract, loadDesignSystem, checkContract, checkDesignSystem, flatten, resolveAliases } from "./tokens.ts";
export type { TokenSet, TokenContract, DesignSystemManifest, ContractIssue } from "./tokens.ts";
export { contrastRatio, luminance, type ColorValue } from "./color.ts";
export { flattenTree, toTree, isTree } from "./tree.ts";
