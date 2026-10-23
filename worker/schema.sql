-- OpenSprachFuchs backend: everything the server stores. No names, no e-mail addresses, no IP addresses.
-- Apply with: npx wrangler d1 execute opensprachfuchs --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS accounts (
  id          INTEGER PRIMARY KEY,
  auth        TEXT NOT NULL UNIQUE,   -- SHA-256 of the access token the app derives from the secret key
  friend_code TEXT NOT NULL UNIQUE,   -- public code for friend requests, e.g. 7KQM-X4D2
  created     TEXT NOT NULL,          -- day the account was created (UTC, YYYY-MM-DD)
  seen        TEXT NOT NULL,          -- last day the account was used; unused for 12 months means deleted
  last_day    TEXT,                   -- last learning day the app reported (the phone's local date)
  prev_day    TEXT,                   -- the learning day before that, so late reports still count for shared streaks
  save        TEXT,                   -- the save, encrypted on the phone (base64); the server cannot read it
  saved_at    INTEGER                 -- the app's time of that save in ms, to tell which copy is newer
);

CREATE TABLE IF NOT EXISTS friendships (
  id          INTEGER PRIMARY KEY,
  a           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,  -- sent the request
  b           INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,  -- received it
  accepted    INTEGER NOT NULL DEFAULT 0,
  streak      INTEGER NOT NULL DEFAULT 0,  -- shared streak: days in a row on which both learned
  streak_day  TEXT,                        -- the last of those days
  gift_a      TEXT,                        -- day (UTC) a last sent b a gift
  gift_b      TEXT,                        -- day (UTC) b last sent a a gift
  gifts_for_a INTEGER NOT NULL DEFAULT 0,  -- unopened gifts
  gifts_for_b INTEGER NOT NULL DEFAULT 0,
  UNIQUE (a, b)
);
CREATE INDEX IF NOT EXISTS friendships_b ON friendships (b);

-- "Fehler melden": content reports, deliberately without any reference to an account.
CREATE TABLE IF NOT EXISTS reports (
  id       INTEGER PRIMARY KEY,
  day      TEXT NOT NULL,
  course   TEXT, pack TEXT, unit TEXT, item TEXT, type TEXT,
  task     TEXT, expected TEXT, given TEXT, note TEXT
);
