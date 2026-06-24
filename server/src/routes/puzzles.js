import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { getPuzzlesDueForUser, getPuzzleStats } from "../db/puzzles.js";

const router = express.Router();

// GET /puzzles/due — puzzles due for review right now
router.get("/due", requireAuth, async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const puzzles = await getPuzzlesDueForUser(req.user.userId, limit);
  res.json({ puzzles, count: puzzles.length });
});

// GET /puzzles/stats — overall puzzle stats for the user
router.get("/stats", requireAuth, async (req, res) => {
  const stats = await getPuzzleStats(req.user.userId);
  res.json({ stats });
});

export default router;