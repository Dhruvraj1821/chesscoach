import { pool } from "./pool.js";

export async function insertBlunder({
  moveId,
  gameId,
  userId,
  fen,
  correctMoveUci,
  tacticalTheme,
  gamePhase,
  timeRemainingSeconds,
}) {
  const { rows } = await pool.query(
    `INSERT INTO blunders
     (move_id, game_id, user_id, fen, correct_move_uci, tactical_theme, game_phase, time_remaining_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      moveId,
      gameId,
      userId,
      fen,
      correctMoveUci,
      tacticalTheme,
      gamePhase,
      timeRemainingSeconds,
    ]
  );
  return rows[0] || null;
}

export async function getBlundersByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT b.*, g.lichess_game_id, g.opening_name
     FROM blunders b
     JOIN games g ON g.id = b.game_id
     WHERE b.user_id = $1
     ORDER BY b.id DESC`,
    [userId]
  );
  return rows;
}