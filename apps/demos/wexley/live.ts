import type { LiveSpec } from "../kit/live.ts";

/**
 * What a screen Wexley writes live may bind to and do. The keys match the library's own intents
 * (repair; bins, report and info; claim), so those documents can serve as the model's examples.
 */
export const LIVE: LiveSpec = {
  product: "wexley",
  data: {
    repair: "view:repair",
    bins: "view:bins",
    report: "view:missedDraft",
    info: "view:missedInfo",
    tax: "view:councilTax",
    fine: "view:fine",
    permit: "view:permit",
    claim: "view:benefitClaim",
  },
};
