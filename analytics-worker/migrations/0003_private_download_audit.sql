CREATE TABLE IF NOT EXISTS private_asset_downloads (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL REFERENCES access_invites(id),
  recipient_id TEXT NOT NULL REFERENCES invite_recipients(id),
  asset_id TEXT NOT NULL,
  downloaded_at TEXT NOT NULL,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_private_downloads_invite
  ON private_asset_downloads(invite_id, downloaded_at);

PRAGMA optimize;
