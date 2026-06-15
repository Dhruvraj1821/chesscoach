CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  lichess_id VARCHAR(64) UNIQUE NOT NULL,
  username VARCHAR(64) NOT NULL,
  access_token TEXT,
  weakness_profile JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);