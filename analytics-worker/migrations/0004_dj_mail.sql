CREATE TABLE IF NOT EXISTS dj_mail_messages (
  id TEXT PRIMARY KEY,
  audience_key TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  sender_address TEXT NOT NULL,
  reply_to TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  source_message_id TEXT UNIQUE,
  received_at TEXT NOT NULL,
  permanent INTEGER NOT NULL DEFAULT 1 CHECK (permanent IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_dj_mail_audience_received
  ON dj_mail_messages(audience_key, received_at DESC);
