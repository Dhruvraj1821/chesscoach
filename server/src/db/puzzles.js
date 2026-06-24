import { pool } from "./pool.js";

export async function insertPuzzle({
  sourceBlunderId,
  userId,
  fen,
  solutionUci,
  theme,
  difficulty,
}) {
  const { rows } = await pool.query(
    `INSERT INTO puzzles
     (source_blunder_id, user_id, fen, solution_uci, theme, difficulty,
      times_seen, times_solved, next_due_at, ease_factor, interval_days)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 0, now(), 2.5, 0)
     ON CONFLICT (source_blunder_id) DO NOTHING
     RETURNING id`,
    [sourceBlunderId, userId, fen, solutionUci, theme, difficulty]
  );
  return rows[0] || null;
}

export async function getPuzzlesDueForUser(userId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM puzzles
     WHERE user_id = $1
       AND next_due_at <= now()
     ORDER BY next_due_at ASC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

export async function getPuzzleById(puzzleId) {
  const { rows } = await pool.query(
    `SELECT * FROM puzzles WHERE id = $1`,
    [puzzleId]
  );
  return rows[0] || null;
}

export async function updatePuzzleAfterReview({
  puzzleId,
  easeFactor,
  intervalDays,
  nextDueAt,
  timesSeen,
  timesSolved,
}) {
  await pool.query(
    `UPDATE puzzles SET
       ease_factor = $1,
       interval_days = $2,
       next_due_at = $3,
       times_seen = $4,
       times_solved = $5,
       last_seen_at = now()
     WHERE id = $6`,
    [easeFactor, intervalDays, nextDueAt, timesSeen, timesSolved, puzzleId]
  );
}

export async function getPuzzlesByTheme(userId, theme, limit = 10) {
  const { rows } = await pool.query(
    `SELECT * FROM puzzles
     WHERE user_id = $1 AND theme = $2
     ORDER BY next_due_at ASC
     LIMIT $3`,
    [userId, theme, limit]
  );
  return rows;
}

export async function getPuzzleStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) as total,
       SUM(CASE WHEN next_due_at <= now() THEN 1 ELSE 0 END) as due,
       SUM(times_seen) as total_attempts,
       SUM(times_solved) as total_solved,
       AVG(ease_factor) as avg_ease_factor
     FROM puzzles
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
}