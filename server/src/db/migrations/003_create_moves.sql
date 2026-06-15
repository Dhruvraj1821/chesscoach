CREATE TABLE IF NOT EXISTS moves (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  move_number INTEGER NOT NULL,
  move_uci VARCHAR(8) NOT NULL,
  fen_before TEXT NOT NULL,
  fen_after TEXT NOT NULL,
  eval_before INTEGER,
  eval_after INTEGER,
  centipawn_loss INTEGER,
  classification VARCHAR(16) CHECK (classification IN ('blunder', 'mistake', 'inaccuracy', 'good', 'excellent')),
  is_critical BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_is_critical ON moves(is_critical);