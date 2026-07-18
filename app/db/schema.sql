-- SIXTH SENSE — leaderboard schema + seed.
-- Load into any Postgres:  psql "$DATABASE_URL" -f app/db/schema.sql

CREATE TABLE IF NOT EXISTS nation_standings (
  code    text PRIMARY KEY,
  name    text NOT NULL,
  flag    text NOT NULL,
  moments integer NOT NULL DEFAULT 0,
  fans    integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS witnessed (
  id          bigserial PRIMARY KEY,
  wallet      text,
  nation_code text,
  fixture_id  bigint,
  lookup_kind text,
  player_name text,
  clock       integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO nation_standings (code, name, flag, moments, fans) VALUES
  ('BR','Brazil','🇧🇷',1840,512),
  ('AR','Argentina','🇦🇷',1712,471),
  ('FR','France','🇫🇷',1533,438),
  ('ES','Spain','🇪🇸',1207,355),
  ('EN','England','🏴󠁧󠁢󠁥󠁮󠁧󠁿',1090,331),
  ('PT','Portugal','🇵🇹',964,289)
ON CONFLICT (code) DO NOTHING;
