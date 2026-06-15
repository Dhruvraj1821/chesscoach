CREATE TABLE IF NOT EXISTS puzzles (
  id SERIAL PRIMARY KEY,
  source_blunder_id INTEGER REFERENCES blunders(id) ON DELETE SET NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fen TEXT NOT NULL,
  solution_uci VARCHAR(8) NOT NULL,
  theme VARCHAR(32),
  difficulty INTEGER DEFAULT 1500,
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_solved INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_puzzles_user_id ON puzzles(user_id);
CREATE INDEX IF NOT EXISTS idx_puzzles_next_due_at ON puzzles(next_due_at);
CREATE INDEX IF NOT EXISTS idx_puzzles_theme ON puzzles(theme);