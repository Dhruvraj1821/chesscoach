CREATE TABLE IF NOT EXISTS blunders (
  id SERIAL PRIMARY KEY,
  move_id INTEGER NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fen TEXT NOT NULL,
  correct_move_uci VARCHAR(8) NOT NULL,
  tactical_theme VARCHAR(32),
  game_phase VARCHAR(16) CHECK (game_phase IN ('opening', 'middlegame', 'endgame')),
  time_remaining_seconds INTEGER,
  coaching_explanation TEXT
);

CREATE INDEX IF NOT EXISTS idx_blunders_user_id ON blunders(user_id);
CREATE INDEX IF NOT EXISTS idx_blunders_tactical_theme ON blunders(tactical_theme);