import type { LiveSpec } from "../kit/live.ts";

/**
 * What a screen Foundry writes live may bind to and do. The keys match the library's own intents
 * (health, filters and results, compare), so those documents can serve as the model's examples.
 */
export const LIVE: LiveSpec = {
  product: "foundry",
  data: {
    health: "view:accountHealth",
    filters: "view:renewingFilters",
    results: "view:renewingResults",
    compare: "view:planCompare",
    team: "view:teamSummary",
    account: "view:accountOverview",
    roles: "view:roles",
  },
};
