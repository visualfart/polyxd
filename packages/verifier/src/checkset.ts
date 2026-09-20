/**
 * A fingerprint of the checks a score was produced under.
 *
 * Two scores are only comparable if the same checks produced them. This has caught us out twice:
 * sft-v3 was compared to sft-v2 across a change in the checks, and then rl-1 was compared to
 * sft-v3 the same way — a seven-point "regression" that was five points of improvement once both
 * were re-scored. A number in a table looks identical either way, so the fingerprint travels with
 * it and the leaderboard refuses to rank across a change.
 *
 * The list is read from the source rather than maintained by hand, because a list maintained by
 * hand is one someone forgets to update on the commit that matters.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** Every check id the static audit can emit, in order. */
export function checkIds(): string[] {
  const source = readFileSync(new URL("./static.ts", import.meta.url), "utf8");
  return [...new Set([...source.matchAll(/check: "([a-z0-9:_-]+)"/g)].map((m) => m[1]))].sort();
}

/** A short, stable fingerprint of that list. */
export function checkSet(): { id: string; checks: string[] } {
  const checks = checkIds();
  return { id: createHash("sha256").update(checks.join(",")).digest("hex").slice(0, 8), checks };
}
