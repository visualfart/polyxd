import type { LiveSpec } from "../kit/live.ts";

/**
 * What a screen Halden writes live may bind to and do. The keys match the library's own intents
 * (card, compare, total, subscriptions), so those documents can serve as the model's examples and a
 * generated screen reads like the rest of the product. The shell's navigation and ask box stay
 * the shell's.
 */
export const LIVE: LiveSpec = {
  product: "halden",
  data: {
    balance: "view:balance",
    card: "view:card",
    compare: "view:monthCompare",
    total: "view:subscriptionsTotal",
    subscriptions: "view:subscriptions",
    payees: "view:payees",
    budgets: "view:budgets",
  },
  exclude: ["ask.open", "nav.go"],
};
