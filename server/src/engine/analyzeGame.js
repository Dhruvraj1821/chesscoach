import { Chess } from "chess.js";
import { classifyMove, isCritical } from "./classifyMove.js";
import { insertMove, markGameAnalyzed } from "../db/moves.js";
import { getGameById } from "../db/games.js";

export async function analyzeGame(gameId, engine) {
  const game = await getGameById(gameId);
  if (!game) throw new Error(`Game ${gameId} not found`);

  const chess = new Chess();
  chess.loadPgn(game.pgn);
  const history = chess.history({ verbose: true });

  if (history.length === 0) {
    await markGameAnalyzed(gameId);
    return { gameId, movesAnalyzed: 0 };
  }

  const replay = new Chess();
  let moveNumber = 0;

  for (const move of history) {
    moveNumber++;

    const fenBefore = replay.fen();
    const beforeEval = await engine.evaluatePosition(fenBefore);

    replay.move(move.san);
    const fenAfter = replay.fen();

    const afterEval = await engine.evaluatePosition(fenAfter);
    const evalAfterFromMoverPerspective = -afterEval.evalCp;

    const centipawnLoss = Math.max(0, beforeEval.evalCp - evalAfterFromMoverPerspective);
    const classification = classifyMove(centipawnLoss);
    const critical = isCritical(classification);

    await insertMove({
      gameId,
      moveNumber,
      moveUci: move.lan,
      fenBefore,
      fenAfter,
      evalBefore: beforeEval.evalCp,
      evalAfter: evalAfterFromMoverPerspective,
      centipawnLoss,
      classification,
      isCritical: critical,
      bestMoveUci: beforeEval.bestMoveUci,
    });
  }

  await markGameAnalyzed(gameId);
  return { gameId, movesAnalyzed: history.length };
}