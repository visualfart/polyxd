import type { LiveSpec } from "../kit/live.ts";

/**
 * What a screen Quay writes live may bind to and do. The keys match the library's own intents
 * (late, dip, filters and results), so those documents can serve as the model's examples.
 */
export const LIVE: LiveSpec = {
  product: "quay",
  data: {
    late: "view:late",
    dip: "view:dip",
    filters: "view:lowFilters",
    results: "view:lowResults",
    discounts: "view:discountsScreen",
  },
};
