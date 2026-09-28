-- Design Directions: a team's taste as the spec's Direction (profile, voice, patterns, rules,
-- exemplars), edited in Studio and fetched by products by key, like a screen. A Direction has
-- versions; at most one is published. Each version keeps the Direction as it was saved (its
-- rules included, as they were then) and the team's own pattern files. Additive: new tables only.
CREATE TABLE directions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                     -- the Direction's name, and what a product fetches it by
  name TEXT NOT NULL,                    -- what people call it, e.g. Halden
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, key)
);

CREATE TABLE direction_versions (
  id TEXT PRIMARY KEY,
  direction_id TEXT NOT NULL REFERENCES directions(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  direction_json TEXT NOT NULL,          -- the Direction, valid against direction.schema.json
  patterns_json TEXT NOT NULL DEFAULT '[]', -- the team's own patterns (pattern.schema.json)
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  UNIQUE (direction_id, number)
);
CREATE INDEX direction_versions_direction ON direction_versions(direction_id, number);
