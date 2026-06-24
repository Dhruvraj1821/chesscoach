import express from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeWeaknessProfile } from "../analysis/weaknessProfile.js";

const router = express.Router();

// POST /analysis/weakness-profile
// Computes and stores the weakness profile for the logged-in user
router.post("/weakness-profile", requireAuth, async (req, res) => {
  const profile = await computeWeaknessProfile(req.user.userId);
  res.json({ profile });
});

// GET /analysis/weakness-profile
// Returns the stored weakness profile
router.get("/weakness-profile", requireAuth, async (req, res) => {
  const { pool } = await import("../db/pool.js");
  const { rows } = await pool.query(
    `SELECT weakness_profile FROM users WHERE id = $1`,
    [req.user.userId]
  );
  const profile = rows[0]?.weakness_profile;
  if (!profile || Object.keys(profile).length === 0) {
    return res.status(404).json({ error: "No weakness profile found. Run POST /analysis/weakness-profile first." });
  }
  res.json({ profile });
});

export default router;