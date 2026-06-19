import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { fetchUserGames, parseLichessGame } from "../utils/lichessApi.js";
import { insertGame, getGamesByUserId } from "../db/games.js";
import { getUserById, getUserWithTokenById } from "../db/users.js";
import { analysisQueue } from "../queues/analysisQueue.js";

const router = express.Router();

// POST /games/import
// Fetches recent games from Lichess, stores new ones, queues analysis jobs
router.post("/import", requireAuth, async (req, res) => {
  const max = parseInt(req.query.max) || 20;
  const user = await getUserWithTokenById(req.user.userId);

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  // Fetch raw NDJSON games from Lichess
  const rawGames = await fetchUserGames(user.username, user.access_token, max);

  if (rawGames.length === 0) {
    return res.json({ imported: 0, queued: 0, message: "No games found on Lichess" });
  }

  let imported = 0;
  let queued = 0;
  const skipped = [];

  for (const rawGame of rawGames) {
    const parsed = parseLichessGame(rawGame, user.lichess_id);

    const game = await insertGame({
      userId: user.id,
      ...parsed,
    });

    if (!game) {
      // ON CONFLICT DO NOTHING hit  
      skipped.push(rawGame.id);
      continue;
    }

    imported++;

    // Queue a Stockfish analysis job for this game
    await analysisQueue.add(
      "analyze-game",
      { gameId: game.id, userId: user.id },
      { jobId: `analyze-${game.id}` } // deterministic jobId prevents duplicate jobs
    );

    queued++;
  }

  res.json({
    imported,
    queued,
    skipped: skipped.length,
    message: `Imported ${imported} new games, queued ${queued} for analysis, skipped ${skipped.length} already in DB`,
  });
});

router.get("/", requireAuth, async (req, res) => {
  const games = await getGamesByUserId(req.user.userId);
  res.json({ games });
});

export default router;