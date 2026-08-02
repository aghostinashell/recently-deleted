PRAGMA foreign_keys = ON;
ALTER TABLE access_invites ADD COLUMN disabled_at TEXT;
ALTER TABLE access_invites ADD COLUMN authorization_version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS owner_sessions (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS owner_audit_log (
  id TEXT PRIMARY KEY, action TEXT NOT NULL, target_type TEXT, target_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owner_content_metadata (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', notes TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_token ON owner_sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_owner_audit_created ON owner_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_owner_content_category ON owner_content_metadata(category, updated_at);
CREATE INDEX IF NOT EXISTS idx_invites_status ON access_invites(disabled_at, revoked_at, last_used_at);
PRAGMA optimize;
