-- Plans and billing (docs/decisions/0004-pricing-and-licensing.md). A workspace is on a plan;
-- Stripe says which, through the webhook. Only the hosted Studio (BILLING=on) reads any of this:
-- a self-hosted one has no limits, and every workspace stays 'free' without it mattering.
ALTER TABLE workspaces ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';   -- free | pro | team | enterprise
ALTER TABLE workspaces ADD COLUMN plan_status TEXT;                    -- Stripe's: active | trialing | past_due | canceled | …
ALTER TABLE workspaces ADD COLUMN billing_interval TEXT;               -- month | year
ALTER TABLE workspaces ADD COLUMN seats INTEGER;                       -- editor seats billed (Team)
ALTER TABLE workspaces ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE workspaces ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE workspaces ADD COLUMN period_end TEXT;                     -- when the paid period renews or ends
ALTER TABLE workspaces ADD COLUMN over_quota_since TEXT;               -- first rollup that found fetches over the plan's
CREATE INDEX workspaces_stripe_customer ON workspaces(stripe_customer_id);

-- Monthly totals, rolled up by the scheduled handler from the fetch counter (Workers Analytics
-- Engine), so no request writes to D1 to be counted. period is 'YYYY-MM' in UTC.
CREATE TABLE usage (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,                  -- fetches
  period TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, metric, period)
);
