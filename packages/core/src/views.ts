/** Views (tabs): which view shows. Bound to data when the document says; local otherwise. */

export interface View {
  key: string;
  label?: unknown;
  count?: unknown;
  content?: string;
}

/** The selected view: the binding's value when it names a view, else the local choice, else the first. */
export function selectedView(views: View[], bound: unknown, local: string | undefined): string {
  if (typeof bound === "string" && bound) return bound;
  return local ?? views[0]?.key;
}

/** Selecting a view: a bound Views writes the key; an unbound one keeps it locally. */
export const viewsReducer = (_current: string, key: string): string => key;
