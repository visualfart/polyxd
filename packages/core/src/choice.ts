/**
 * Choice picks its control from the options' number and shape (the Choice rendering rules):
 * people or things with faces → a picker (recent row, then a list); a few short options → chips
 * (a segmented control); otherwise radios or checkboxes, searchable past 10. Every renderer
 * makes the same call here, so a document reads the same whichever draws it.
 */
import type { Option } from "./options.ts";

export type ChoiceControl = "chips" | "people" | "list";

export interface ChoicePlan {
  control: ChoiceControl;
  multiple: boolean;
  /** Past this many options a filter field sits above them */
  searchable: boolean;
  withFaces: boolean;
}

/** Chips hold this many short options at most; more become a list. */
export const CHIPS_MAX = 6;
/** The longest label a chip can carry. */
export const CHIP_LABEL_MAX = 24;
/** Past this many options the list gets a filter; with faces the threshold is the chips' limit. */
export const SEARCHABLE_PAST = 10;

export function planChoice(options: Option[], mode: string | undefined): ChoicePlan {
  const withFaces = options.some((o) => o.avatar !== undefined);
  const searchable = options.length > SEARCHABLE_PAST || (withFaces && options.length > CHIPS_MAX);
  const chips = !withFaces && options.length <= CHIPS_MAX && options.every((o) => o.label.length <= CHIP_LABEL_MAX && !o.description);
  return { control: chips ? "chips" : withFaces ? "people" : "list", multiple: mode === "multiple", searchable, withFaces };
}

/** Values compare by their JSON: 1 and "1" are different options, {a:1} equals {a:1}. */
export const optionKey = (v: unknown): string => JSON.stringify(v);

export const matchesQuery = (o: Option, query: string): boolean => !query || `${o.label} ${o.description ?? ""}`.toLowerCase().includes(query.toLowerCase());

/** People or places: recent ones as a row of faces, everyone else as a list. A search shows matches only. */
export function partitionRecent(options: Option[], query: string): { recent: Option[]; rest: Option[] } {
  return { recent: query ? [] : options.filter((o) => o.recent), rest: options.filter((o) => (query ? matchesQuery(o, query) : !o.recent)) };
}

/** A multiple choice's next selection after one option is toggled. */
export function toggleSelection(selected: unknown, value: unknown): unknown[] {
  const cur = Array.isArray(selected) ? selected : [];
  const k = optionKey(value);
  return cur.some((x) => optionKey(x) === k) ? cur.filter((x) => optionKey(x) !== k) : [...cur, value];
}

export const isSelected = (selected: unknown, value: unknown): boolean => {
  const k = optionKey(value);
  return Array.isArray(selected) ? selected.some((x) => optionKey(x) === k) : selected !== null && selected !== undefined && optionKey(selected) === k;
};

/** The placeholder for the filter field: by name for people, by text otherwise. */
export const searchPlaceholder = (withFaces: boolean): string => (withFaces ? "Search by name" : "Filter options");
