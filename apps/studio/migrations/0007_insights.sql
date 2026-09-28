-- Studio Insights: how a workspace's screens perform, from the semantic events its own products
-- send (POST /api/w/<workspace>/events). Additive: new tables only.

-- An ingest key goes in a product's pages, where anyone can read it, so it is kept as it is (and
-- shown again in Studio). It can send events to its workspace and nothing else: the Worker never
-- reads it as an API key or a session.
CREATE TABLE ingest_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,              -- pxi_ and 48 hex digits
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX ingest_keys_workspace ON ingest_keys(workspace_id);

-- Daily counts, and nothing else: no event is stored, no session id, no timestamp finer than the
-- day, no value. One row per day and combination of the dimensions below; an event adds 1 to
-- count. Every text dimension is a short code (letters, digits, . _ : -) or empty.
CREATE TABLE insight_counts (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                     -- YYYY-MM-DD (UTC), the day Studio received the events
  intent TEXT NOT NULL,                  -- surface.intent
  surface TEXT NOT NULL DEFAULT '',      -- surface.id
  pattern TEXT NOT NULL DEFAULT '',      -- surface.pattern
  type TEXT NOT NULL,                    -- the event type
  component TEXT NOT NULL DEFAULT '',    -- component.key, else component.id (actions, input errors, statuses, undo)
  capability TEXT NOT NULL DEFAULT '',   -- actions, checkpoints, completions, undo
  reason TEXT NOT NULL DEFAULT '',       -- the reason code (input errors, statuses, abandons, dismissals, feedback, regenerations)
  source TEXT NOT NULL DEFAULT 'authored', -- generated (the event names a generator) | authored
  actor TEXT NOT NULL DEFAULT 'human',   -- human | agent
  count INTEGER NOT NULL DEFAULT 0,
  duration_sum INTEGER NOT NULL DEFAULT 0,   -- task.completed: sum of durationMs, each capped at a day
  duration_count INTEGER NOT NULL DEFAULT 0,
  -- task.completed: how many took under 2 s, 2-5 s, 5-10 s, 10-30 s, 30-60 s, 1-2 min, 2-5 min, over 5 min
  d0 INTEGER NOT NULL DEFAULT 0, d1 INTEGER NOT NULL DEFAULT 0, d2 INTEGER NOT NULL DEFAULT 0, d3 INTEGER NOT NULL DEFAULT 0,
  d4 INTEGER NOT NULL DEFAULT 0, d5 INTEGER NOT NULL DEFAULT 0, d6 INTEGER NOT NULL DEFAULT 0, d7 INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,     -- feedback: sum of ratings (-1, 0, 1)
  rating_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, day, intent, surface, pattern, type, component, capability, reason, source, actor)
);
CREATE INDEX insight_counts_intent ON insight_counts(workspace_id, intent, day);
