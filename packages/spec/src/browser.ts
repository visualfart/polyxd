/**
 * The parts of the spec that run anywhere: browsers, Workers, edge runtimes. Nothing here touches
 * the file system. The root entry adds the token contract and patterns, which read their JSON from
 * disk and belong in Node.
 */
export { SPEC_VERSION } from "./version.ts";
export { validateDocument, uiSchema, type Issue, type ValidationResult, type ValidateOptions } from "./validate.ts";
export { flattenTree, toTree, isTree } from "./tree.ts";
export { alphaOf, contrastRatio, luminance, over, parseColor, rgbToHex, toRgb, type ColorValue, type Rgb } from "./color.ts";
export { readingGrade } from "./checks.ts";
export { compileVoice, directionRules } from "./direction.ts";
export { REFERENCE_TYPES } from "./references.ts";
