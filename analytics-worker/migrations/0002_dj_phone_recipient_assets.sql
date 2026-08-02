ALTER TABLE invite_recipients
  ADD COLUMN personalized_artwork_path TEXT;

PRAGMA optimize;
