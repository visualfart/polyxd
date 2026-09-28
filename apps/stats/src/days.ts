/** A UTC calendar day, "YYYY-MM-DD". Every source, event and ledger key is keyed by one. */
export type Day = string;

const DAY_MS = 86_400_000;

export const toDay = (date: Date): Day => date.toISOString().slice(0, 10);

export const addDays = (day: Day, n: number): Day => toDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));

/** The day before `now`, in UTC: what a run at 02:00 UTC describes. */
export const yesterday = (now: Date): Day => addDays(toDay(now), -1);

/** Whole days from `a` to `b` (positive when b is later). */
export const daysBetween = (a: Day, b: Day): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

/** The `count` days ending on `last`, oldest first. */
export const daysEndingOn = (last: Day, count: number): Day[] => Array.from({ length: count }, (_, i) => addDays(last, i - count + 1));

/** Noon UTC on `day`: the timestamp an event about that day carries, so charts put it in the right bucket in any time zone. */
export const noonOf = (day: Day): string => `${day}T12:00:00.000Z`;
