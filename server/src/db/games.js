import { pool } from "./pool.js";

export async function insertGame({
  userId,
  lichessGameId,
  pgn,
  playedAt,
  result,
  openingName,
  timeControl,
}) {
  const { rows } = await pool.query(
    `INSERT INTO games (user_id, lichess_game_id, pgn, played_at, result, opening_name, time_control)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, lichess_game_id) DO NOTHING
     RETURNING id, lichess_game_id`,
    [userId, lichessGameId, pgn, playedAt, result, openingName, timeControl]
  );
  // Returns null if the game already existed 
  return rows[0] || null;
}

export async function getGamesByUserId(userId) {
  const { rows } = await pool.query(
    `SELECT id, lichess_game_id, played_at, result, opening_name, time_control, analyzed
     FROM games
     WHERE user_id = $1
     ORDER BY played_at DESC`,
    [userId]
  );
  return rows;
}

export async function getGameById(gameId) {
  const { rows } = await pool.query(
    `SELECT * FROM games WHERE id = $1`,
    [gameId]
  );
  return rows[0] || null;
}
