/**
 * The parts of the spec that run anywhere: browsers, Workers, edge runtimes. Nothing here touches
 * the file system. The root entry adds the token contract, patterns and Design Direction, which read
 * their JSON from disk and belong in Node.
 */
export { SPEC_VERSION } from "./version.ts";
export { validateDocument, uiSchema, type Issue, type ValidationResult, type ValidateOptions } from "./validate.ts";
export { flattenTree, toTree, isTree } from "./tree.ts";
export { alphaOf, contrastRatio, luminance, over, parseColor, rgbToHex, toRgb, type ColorValue, type Rgb } from "./color.ts";
export { readingGrade } from "./checks.ts";
export { REFERENCE_TYPES } from "./references.ts";
