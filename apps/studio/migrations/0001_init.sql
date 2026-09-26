-- Polyxd Studio, first schema. Ids are UUIDs; times are ISO-8601 text.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- owner: everything. design-system: tokens, components, rules, releases. designer: direction,
-- reviews, exemplars. product: capabilities, journeys, insights. engineer: components,
-- capabilities, integrations. viewer: read only.
CREATE TABLE memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  invited_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT
);

CREATE TABLE design_systems (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,            -- tokens-studio | dtcg | css | figma
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- One version per import or edit. The token graph itself lives in R2 at versions/<id>/graph.json;
-- the scan summary is small enough to keep here.
CREATE TABLE ds_versions (
  id TEXT PRIMARY KEY,
  design_system_id TEXT NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status TEXT NOT NULL,            -- draft | live | retired
  file_name TEXT NOT NULL DEFAULT '',
  scan_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX ds_versions_ds ON ds_versions(design_system_id, number);

-- A person's decision about which of their tokens a Polyxd role reads. Roles without a row use
-- Studio's guess, recomputed from the graph on every read.
CREATE TABLE role_overrides (
  version_id TEXT NOT NULL REFERENCES ds_versions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  token_path TEXT,                 -- NULL means "leave this role unmapped on purpose"
  decided_by TEXT NOT NULL REFERENCES users(id),
  decided_at TEXT NOT NULL,
  PRIMARY KEY (version_id, role)
);

-- Built-in components get a row only once someone changes something about them; custom ones
-- always have one. name is the spec name, or namespaced for custom ones (acme:OrderTimeline).
CREATE TABLE components (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,              -- builtin | custom
  enabled INTEGER NOT NULL DEFAULT 1,
  renderer_json TEXT,              -- { "package": "@acme/ui", "export": "Select", "props": {...} } or NULL for Polyxd's
  guidance_json TEXT,              -- { "summary", "whenToUse": [], "whenNotToUse": [] } overrides for the generator
  definition_json TEXT,            -- custom only: { props, role, agent, fallback }
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT,
  PRIMARY KEY (workspace_id, name)
);

CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL,          -- error | warning
  check_json TEXT NOT NULL,        -- a spec check (schema/check.schema.json)
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX rules_ws ON rules(workspace_id);
