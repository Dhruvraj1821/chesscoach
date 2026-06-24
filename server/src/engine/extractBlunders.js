import { getCriticalMovesByGameId } from "../db/moves.js";
import { insertBlunder } from "../db/blunders.js";
import { detectTacticalTheme } from "./detectTheme.js";
import { getGameById } from "../db/games.js";

// Move number thresholds for game phase classification
const OPENING_THRESHOLD = 15;
const MIDDLEGAME_THRESHOLD = 40;

function getGamePhase(moveNumber) {
  if (moveNumber <= OPENING_THRESHOLD) return "opening";
  if (moveNumber <= MIDDLEGAME_THRESHOLD) return "middlegame";
  return "endgame";
}

/**
 * Reads all critical moves for a game, enriches them with tactical
 * context, and inserts them into the blunders table.
 */
export async function extractBlunders(gameId, userId) {
  const game = await getGameById(gameId);
  if (!game) throw new Error(`Game ${gameId} not found`);

  const criticalMoves = await getCriticalMovesByGameId(gameId);

  if (criticalMoves.length === 0) {
    console.log(`Game ${gameId} has no critical moves to extract`);
    return { gameId, blundersExtracted: 0 };
  }

  let blundersExtracted = 0;

  for (const move of criticalMoves) {
    const gamePhase = getGamePhase(move.move_number);

    const tacticalTheme = detectTacticalTheme(
      move.fen_before,
      move.move_uci,
      move.best_move_uci
    );

    // correct_move_uci = the best move the engine found before the blunder
    const correctMoveUci = move.best_move_uci || move.move_uci;

    const blunder = await insertBlunder({
      moveId: move.id,
      gameId,
      userId,
      fen: move.fen_before, // position where the mistake was made
      correctMoveUci,
      tacticalTheme,
      gamePhase,
      timeRemainingSeconds: null, // clock data not available without re-importing with clocks:true
    });

    if (blunder) blundersExtracted++;
  }

  console.log(`Game ${gameId}: extracted ${blundersExtracted} blunders`);
  return { gameId, blundersExtracted };
}