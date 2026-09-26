-- Sign-in moves to better-auth (open source, in the Worker): its user, session, account and
-- verification tables replace Studio's own users and sessions. Nothing had signed in yet, so the
-- tables that pointed at users(id) are rebuilt to point at user(id).

DROP TABLE IF EXISTS rules;
DROP TABLE IF EXISTS components;
DROP TABLE IF EXISTS role_overrides;
DROP TABLE IF EXISTS ds_versions;
DROP TABLE IF EXISTS design_systems;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS registries;
DROP TABLE IF EXISTS invites;
DROP TABLE IF EXISTS memberships;
DROP TABLE IF EXISTS workspaces;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- better-auth's core schema (camelCase columns, ISO-8601 text for dates on SQLite).
CREATE TABLE user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  expiresAt TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX session_user ON session(userId);
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accessToken TEXT,
  refreshToken TEXT,
  idToken TEXT,
  accessTokenExpiresAt TEXT,
  refreshTokenExpiresAt TEXT,
  scope TEXT,
  password TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX account_user ON account(userId);
CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX verification_identifier ON verification(identifier);

-- Studio's own tables, as in 0001 and 0002, pointing at user(id).
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE memberships (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
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
  invited_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT
);
CREATE TABLE registries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  token_enc TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL
);
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE TABLE design_systems (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE ds_versions (
  id TEXT PRIMARY KEY,
  design_system_id TEXT NOT NULL REFERENCES design_systems(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  status TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  scan_json TEXT NOT NULL,
  package_name TEXT,
  package_version TEXT,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  published_at TEXT
);
CREATE INDEX ds_versions_ds ON ds_versions(design_system_id, number);
CREATE TABLE role_overrides (
  version_id TEXT NOT NULL REFERENCES ds_versions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  token_path TEXT,
  decided_by TEXT NOT NULL REFERENCES user(id),
  decided_at TEXT NOT NULL,
  PRIMARY KEY (version_id, role)
);
CREATE TABLE components (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  renderer_json TEXT,
  guidance_json TEXT,
  definition_json TEXT,
  updated_by TEXT REFERENCES user(id),
  updated_at TEXT,
  PRIMARY KEY (workspace_id, name)
);
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  why TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL,
  check_json TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL REFERENCES user(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX rules_ws ON rules(workspace_id);
