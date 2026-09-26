-- Where a workspace's private packages live. The token is AES-GCM encrypted with SECRETS_KEY and
-- shown to nobody after saving; scope narrows it to packages under that npm scope.
CREATE TABLE registries (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT '',
  token_enc TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

-- A key `polyxd studio push` uses from inside a company's network. Only its SHA-256 is kept.
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

ALTER TABLE ds_versions ADD COLUMN package_name TEXT;
ALTER TABLE ds_versions ADD COLUMN package_version TEXT;
