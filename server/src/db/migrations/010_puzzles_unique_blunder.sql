ALTER TABLE puzzles
  ADD CONSTRAINT puzzles_source_blunder_id_unique
  UNIQUE (source_blunder_id);