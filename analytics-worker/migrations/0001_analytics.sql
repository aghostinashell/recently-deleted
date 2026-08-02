PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS anonymous_visitors (
  id TEXT PRIMARY KEY,
  first_visit_at TEXT NOT NULL,
  last_visit_at TEXT NOT NULL,
  total_visits INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invite_recipients (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'DJ',
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS access_invites (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES invite_recipients(id),
  token_hash TEXT NOT NULL UNIQUE,
  access_type TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  total_visits INTEGER NOT NULL DEFAULT 0,
  first_used_at TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_sessions (
  id TEXT PRIMARY KEY,
  anonymous_visitor_id TEXT NOT NULL REFERENCES anonymous_visitors(id),
  access_type TEXT NOT NULL,
  invite_id TEXT REFERENCES access_invites(id),
  recipient_id TEXT REFERENCES invite_recipients(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_category TEXT,
  browser TEXT,
  operating_system TEXT,
  screen_size TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  anonymous_visitor_id TEXT NOT NULL REFERENCES anonymous_visitors(id),
  session_id TEXT NOT NULL REFERENCES analytics_sessions(id),
  access_type TEXT NOT NULL,
  invite_id TEXT REFERENCES access_invites(id),
  recipient_id TEXT REFERENCES invite_recipients(id),
  recipient_display_name TEXT,
  app_name TEXT,
  content_id TEXT,
  content_title TEXT,
  page TEXT,
  route TEXT,
  referrer TEXT,
  device_category TEXT,
  browser TEXT,
  operating_system TEXT,
  screen_size TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  is_returning INTEGER NOT NULL DEFAULT 0 CHECK (is_returning IN (0, 1)),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  event_timestamp TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_test INTEGER NOT NULL DEFAULT 0 CHECK (is_test IN (0, 1))
);

CREATE TABLE IF NOT EXISTS downloadable_assets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  file_type TEXT,
  storage_key TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS music_tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  album_title TEXT,
  runtime_seconds INTEGER,
  version TEXT,
  file_format TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exposure_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  venue_id TEXT,
  media_id TEXT,
  starts_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_name_timestamp
  ON analytics_events(event_name, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_session
  ON analytics_events(session_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_visitor
  ON analytics_events(anonymous_visitor_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_events_invite
  ON analytics_events(invite_id, event_timestamp) WHERE invite_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_invite
  ON analytics_sessions(invite_id, started_at) WHERE invite_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invites_recipient
  ON access_invites(recipient_id);

PRAGMA optimize;
