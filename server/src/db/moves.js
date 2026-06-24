import { pool } from "./pool.js";

export async function insertMove({
  gameId,
  moveNumber,
  moveUci,
  fenBefore,
  fenAfter,
  evalBefore,
  evalAfter,
  centipawnLoss,
  classification,
  isCritical,
}) {
  const { rows } = await pool.query(
    `INSERT INTO moves
     (game_id, move_number, move_uci, fen_before, fen_after, eval_before, eval_after, centipawn_loss, classification, is_critical)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      gameId,
      moveNumber,
      moveUci,
      fenBefore,
      fenAfter,
      evalBefore,
      evalAfter,
      centipawnLoss,
      classification,
      isCritical,
    ]
  );
  return rows[0];
}

export async function markGameAnalyzed(gameId) {
  await pool.query(`UPDATE games SET analyzed = true WHERE id = $1`, [gameId]);
}

export async function getMovesByGameId(gameId) {
  const { rows } = await pool.query(
    `SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number ASC`,
    [gameId]
  );
  return rows;
}