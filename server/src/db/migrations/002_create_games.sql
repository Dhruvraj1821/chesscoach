CREATE TABLE IF NOT EXISTS games (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lichess_game_id VARCHAR(32) NOT NULL,
  pgn TEXT NOT NULL,
  played_at TIMESTAMPTZ,
  analyzed BOOLEAN NOT NULL DEFAULT false,
  result VARCHAR(16),
  opening_name VARCHAR(128),
  time_control VARCHAR(32),
  UNIQUE (user_id, lichess_game_id)
);

CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_games_analyzed ON games(analyzed);