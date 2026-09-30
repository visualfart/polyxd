-- Every change a super admin makes to someone else's workspace or membership, kept for good.
-- Reading is not recorded; only what changed, who changed it, and why they said they did.
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  admin_email TEXT NOT NULL,          -- from SUPER_ADMINS, not from the database, so it can't be forged by editing a row
  action TEXT NOT NULL,               -- plan | owner | member-removed | verification-sent
  workspace_id TEXT,                  -- no foreign key: the record outlives the workspace
  user_id TEXT,
  before TEXT,
  after TEXT,
  note TEXT
);
CREATE INDEX admin_actions_at ON admin_actions(at DESC);
CREATE INDEX admin_actions_workspace ON admin_actions(workspace_id);
