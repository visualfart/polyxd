import type { Direction, UIDocument } from "@polyxd/runtime";
import type { LiveSpec } from "../kit/live.ts";
import type { IntentFile, Registry } from "../kit/types.ts";

import haldenDirection from "../halden/direction.json" with { type: "json" };
import haldenRegistry from "../halden/registry.json" with { type: "json" };
import { seed as haldenSeed } from "../halden/seed.ts";
import { surfaceData as haldenData } from "../halden/views.ts";
import { LIVE as haldenLive } from "../halden/live.ts";
import haldenCard from "../halden/intents/card.freeze.json" with { type: "json" };
import haldenCompare from "../halden/intents/spend.compare.json" with { type: "json" };
import haldenSubscriptions from "../halden/intents/subscriptions.list.json" with { type: "json" };

import foundryDirection from "../foundry/direction.json" with { type: "json" };
import foundryRegistry from "../foundry/registry.json" with { type: "json" };
import { seed as foundrySeed } from "../foundry/seed.ts";
import { surfaceData as foundryData } from "../foundry/views.ts";
import { LIVE as foundryLive } from "../foundry/live.ts";
import foundryHealth from "../foundry/intents/account.health.json" with { type: "json" };
import foundryRenewing from "../foundry/intents/accounts.renewing-with-tickets.json" with { type: "json" };
import foundryPlans from "../foundry/intents/plans.compare.json" with { type: "json" };

import wexleyDirection from "../wexley/direction.json" with { type: "json" };
import wexleyRegistry from "../wexley/registry.json" with { type: "json" };
import { seed as wexleySeed } from "../wexley/seed.ts";
import { surfaceData as wexleyData } from "../wexley/views.ts";
import { LIVE as wexleyLive } from "../wexley/live.ts";
import wexleyRepair from "../wexley/intents/repair.status.json" with { type: "json" };
import wexleyBins from "../wexley/intents/bin.missed.json" with { type: "json" };
import wexleyBenefit from "../wexley/intents/benefit.evidence.json" with { type: "json" };

import quayDirection from "../quay/direction.json" with { type: "json" };
import quayRegistry from "../quay/registry.json" with { type: "json" };
import { seed as quaySeed } from "../quay/seed.ts";
import { surfaceData as quayData } from "../quay/views.ts";
import { LIVE as quayLive } from "../quay/live.ts";
import quayLate from "../quay/intents/orders.late.json" with { type: "json" };
import quayDip from "../quay/intents/revenue.dip.json" with { type: "json" };
import quayLow from "../quay/intents/inventory.low.json" with { type: "json" };

/**
 * What the live endpoint knows about each product: its Design Direction, its registry, the data a
 * generated screen may bind to (built from the seed, never from a visitor), and a few of its own
 * verified documents as examples for the model.
 */
export interface LiveProduct {
  spec: LiveSpec;
  direction: Direction;
  registry: Registry;
  /** The product's live views over a fresh seed. */
  data: () => Record<string, unknown>;
  /** Library documents whose data keys are all live keys, so their bindings hold for a live screen too. */
  exemplars: { request: string; document: UIDocument }[];
}

type IntentJson = Pick<IntentFile, "id" | "ask" | "data"> & { document: unknown };

/** An intent is an example only when every data key it binds is a live key with the same view. */
export function exemplarsFor(spec: LiveSpec, intents: IntentJson[]): LiveProduct["exemplars"] {
  return intents
    .filter((i) => i.ask.length > 0 && Object.entries(i.data).every(([key, source]) => spec.data[key] === source))
    .map((i) => {
      const { data: _snapshot, ...document } = i.document as UIDocument;
      return { request: i.ask[0], document: document as UIDocument };
    });
}

const product = <T,>(spec: LiveSpec, direction: unknown, registry: unknown, seed: () => T, surfaceData: (state: T, intent: { data: Record<string, unknown> }, slots: Record<string, unknown>) => Record<string, unknown>, intents: unknown[]): LiveProduct => ({
  spec,
  direction: direction as Direction,
  registry: registry as Registry,
  data: () => surfaceData(seed(), { data: spec.data }, {}),
  exemplars: exemplarsFor(spec, intents as IntentJson[]),
});

export const PRODUCTS: Record<LiveSpec["product"], LiveProduct> = {
  halden: product(haldenLive, haldenDirection, haldenRegistry, haldenSeed, haldenData, [haldenCard, haldenCompare, haldenSubscriptions]),
  foundry: product(foundryLive, foundryDirection, foundryRegistry, foundrySeed, foundryData, [foundryHealth, foundryRenewing, foundryPlans]),
  wexley: product(wexleyLive, wexleyDirection, wexleyRegistry, wexleySeed, wexleyData, [wexleyRepair, wexleyBins, wexleyBenefit]),
  quay: product(quayLive, quayDirection, quayRegistry, quaySeed, quayData, [quayLate, quayDip, quayLow]),
};
