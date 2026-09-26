/** Version of the Polyxd spec that documents produced by this package conform to. */
export const SPEC_VERSION = "0.2.0";

export { validateDocument, uiSchema, type Issue, type ValidationResult } from "./validate.ts";
export { loadContract, loadDesignSystem, checkContract, checkDesignSystem, flatten, resolveAliases } from "./tokens.ts";
export type { TokenSet, TokenContract, DesignSystemManifest, ContractIssue } from "./tokens.ts";
export { alphaOf, contrastRatio, luminance, over, parseColor, rgbToHex, toRgb, type ColorValue, type Rgb } from "./color.ts";
export { flattenTree, toTree, isTree } from "./tree.ts";
export { compileVoice, directionRules } from "./direction.ts";
export { readingGrade } from "./checks.ts";
export { REFERENCE_TYPES } from "./references.ts";
