import { pool } from "../db/pool.js";
import { insertPuzzle } from "../db/puzzles.js";

function seedDifficulty(centipawnLoss) {
  if (centipawnLoss < 200) return 1200;
  if (centipawnLoss < 500) return 1500;
  return 1800;
}

/**
 * Converts all blunders for a game into puzzle records.
 * Skips blunders that already have a puzzle (idempotent).
 */
export async function generatePuzzlesForGame(gameId, userId) {
  // Fetch all blunders for this game joined with centipawn loss
  const { rows: blunders } = await pool.query(
    `SELECT b.id, b.fen, b.correct_move_uci, b.tactical_theme, m.centipawn_loss
     FROM blunders b
     JOIN moves m ON m.id = b.move_id
     WHERE b.game_id = $1 AND b.user_id = $2`,
    [gameId, userId]
  );

  if (blunders.length === 0) {
    return { gameId, puzzlesGenerated: 0 };
  }

  let puzzlesGenerated = 0;

  for (const blunder of blunders) {
    const difficulty = seedDifficulty(parseInt(blunder.centipawn_loss) || 0);

    const puzzle = await insertPuzzle({
      sourceBlunderId: blunder.id,
      userId,
      fen: blunder.fen,
      solutionUci: blunder.correct_move_uci,
      theme: blunder.tactical_theme,
      difficulty,
    });

    if (puzzle) puzzlesGenerated++;
  }

  console.log(`Game ${gameId}: generated ${puzzlesGenerated} puzzles`);
  return { gameId, puzzlesGenerated };
}