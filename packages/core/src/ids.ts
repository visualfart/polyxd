/** Element ids from values: JSON is exact but not id-safe ("p_tom" has quotes), so it is encoded. */
export const idOf = (prefix: string, value: unknown): string => `${prefix}-${encodeURIComponent(JSON.stringify(value)).replace(/%/g, "_")}`;

/** A generator of ids unique within one surface, for label/control pairs and live regions. */
export function idGenerator(prefix = "pxd"): () => string {
  let n = 0;
  return () => `${prefix}-${(n++).toString(36)}`;
}
