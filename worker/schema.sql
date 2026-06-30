-- Chạy 1 lần: wrangler d1 execute lol-schedule-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,           -- hash của team1+team2+datetime+tournament
  tournament TEXT NOT NULL,      -- 'MSI 2026' hoặc 'LCK 2026'
  stage TEXT,                    -- vd: 'Play-In', 'Bracket Stage', 'Rounds 1-2'
  team1 TEXT,
  team1_logo TEXT,
  team2 TEXT,
  team2_logo TEXT,
  best_of INTEGER,
  datetime_utc TEXT NOT NULL,    -- ISO 8601 UTC
  team1_score INTEGER,
  team2_score INTEGER,
  status TEXT DEFAULT 'upcoming' -- 'upcoming' | 'live' | 'finished'
);

CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament);
CREATE INDEX IF NOT EXISTS idx_matches_datetime ON matches(datetime_utc);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
