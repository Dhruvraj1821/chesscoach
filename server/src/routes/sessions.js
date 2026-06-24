import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { buildDailySession } from "../analysis/buildSession.js";
import { getSessionById, recordPuzzleAttempt, updateSessionProgress } from "../db/sessions.js";
import { getPuzzleById, updatePuzzleAfterReview } from "../db/puzzles.js";
import { calculateNextReview, outcomeToQuality } from "../analysis/sm2.js";

const router = express.Router();

// POST /sessions/daily — get or create today's session
router.post("/daily", requireAuth, async (req, res) => {
  const session = await buildDailySession(req.user.userId);
  res.json({ session });
});

// GET /sessions/:id — get a specific session with all puzzles
router.get("/:id", requireAuth, async (req, res) => {
  const session = await getSessionById(parseInt(req.params.id));
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json({ session });
});

// POST /sessions/:id/puzzles/:sessionPuzzleId/submit
// Submit a puzzle attempt — records result and updates SM-2 schedule
router.post("/:id/puzzles/:sessionPuzzleId/submit", requireAuth, async (req, res) => {
  const { solved, attempts, timeTakenSeconds, puzzleId } = req.body;

  if (typeof solved !== "boolean" || !puzzleId) {
    return res.status(400).json({ error: "solved (boolean) and puzzleId are required" });
  }

  // Record the attempt in session_puzzles
  await recordPuzzleAttempt(parseInt(req.params.sessionPuzzleId), {
    solved,
    attempts: attempts || 1,
    timeTakenSeconds: timeTakenSeconds || 0,
  });

  // Update SM-2 schedule for this puzzle
  const puzzle = await getPuzzleById(parseInt(puzzleId));
  if (!puzzle) return res.status(404).json({ error: "Puzzle not found" });

  const quality = outcomeToQuality({
    solved,
    attempts: attempts || 1,
    timeTakenSeconds: timeTakenSeconds || 0,
  });

  const { easeFactor, intervalDays, nextDueAt } = calculateNextReview({
    easeFactor: parseFloat(puzzle.ease_factor),
    intervalDays: parseFloat(puzzle.interval_days),
    quality,
  });

  await updatePuzzleAfterReview({
    puzzleId: puzzle.id,
    easeFactor,
    intervalDays,
    nextDueAt,
    timesSeen: puzzle.times_seen + 1,
    timesSolved: puzzle.times_solved + (solved ? 1 : 0),
  });

  // Update session aggregate stats
  const session = await getSessionById(parseInt(req.params.id));
  if (session) {
    const attempted = session.puzzles.filter((p) => p.solved !== null).length;
    const solvedCount = session.puzzles.filter((p) => p.solved === true).length;
    await updateSessionProgress(session.id, {
      puzzlesAttempted: attempted,
      puzzlesSolved: solvedCount,
    });
  }

  res.json({
    success: true,
    nextReview: { easeFactor, intervalDays, nextDueAt },
    quality,
  });
});

export default router;