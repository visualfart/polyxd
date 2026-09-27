-- Screens: surfaces a designer authors in Studio and a product fetches by key. A screen has
-- versions; at most one is published. Each version keeps the whole document (with its sample
-- data) and the validation result from when it was saved, so history reads without re-checking.
CREATE TABLE screens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key TEXT NOT NULL,                     -- slug a product fetches by, unique in the workspace
  name TEXT NOT NULL,
  intent TEXT NOT NULL DEFAULT '',       -- surface.intent, e.g. money.send
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, key)
);

CREATE TABLE screen_versions (
  id TEXT PRIMARY KEY,
  screen_id TEXT NOT NULL REFERENCES screens(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  document_json TEXT NOT NULL,           -- the document, sample data included
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',  -- draft | published
  issues_json TEXT NOT NULL,             -- { valid, issues } at save
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  UNIQUE (screen_id, number)
);
CREATE INDEX screen_versions_screen ON screen_versions(screen_id, number);
