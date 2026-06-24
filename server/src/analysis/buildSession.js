import { pool } from "../db/pool.js";
import {
  getTodaysSession,
  createSession,
  addPuzzleToSession,
} from "../db/sessions.js";
import { getPuzzlesDueForUser } from "../db/puzzles.js";

const SESSION_SIZE = 10;

/**
 * Builds a daily session for the user.
 * Returns existing session if one already exists for today.
 *
 * Session composition:
 * 1. SRS-due puzzles (overdue reviews)
 * 2. New puzzles matching user's top weakness themes
 * 3. Fallback: any unseen puzzles
 */
export async function buildDailySession(userId) {
  // Return existing session if already built today
  const existing = await getTodaysSession(userId);
  if (existing) return existing;

  // Get user's weakness profile for theme-matched selection
  const { rows: userRows } = await pool.query(
    `SELECT weakness_profile FROM users WHERE id = $1`,
    [userId]
  );
  const profile = userRows[0]?.weakness_profile || {};
  const topThemes = (profile.top_themes || []).map((t) => t.theme);

  // Step 1: get SRS-due puzzles
  const duePuzzles = await getPuzzlesDueForUser(userId, SESSION_SIZE);
  const selectedIds = new Set(duePuzzles.map((p) => p.id));
  const selected = [...duePuzzles];

  // Step 2: fill remaining slots with theme-matched new puzzles
  if (selected.length < SESSION_SIZE && topThemes.length > 0) {
    const remaining = SESSION_SIZE - selected.length;
    const excludeIds = selected.length > 0 ? selected.map((p) => p.id) : [0];

    const { rows: themeMatched } = await pool.query(
      `SELECT * FROM puzzles
       WHERE user_id = $1
         AND theme = ANY($2)
         AND times_seen = 0
         AND id != ALL($3)
       ORDER BY difficulty ASC
       LIMIT $4`,
      [userId, topThemes, excludeIds, remaining]
    );

    for (const p of themeMatched) {
      if (!selectedIds.has(p.id)) {
        selected.push(p);
        selectedIds.add(p.id);
      }
    }
  }

  // Step 3: fallback — any unseen puzzles
  if (selected.length < SESSION_SIZE) {
    const remaining = SESSION_SIZE - selected.length;
    const excludeIds = selected.length > 0 ? selected.map((p) => p.id) : [0];

    const { rows: fallback } = await pool.query(
      `SELECT * FROM puzzles
       WHERE user_id = $1
         AND times_seen = 0
         AND id != ALL($2)
       ORDER BY next_due_at ASC
       LIMIT $3`,
      [userId, excludeIds, remaining]
    );

    for (const p of fallback) {
      if (!selectedIds.has(p.id)) {
        selected.push(p);
        selectedIds.add(p.id);
      }
    }
  }

  if (selected.length === 0) {
    return { empty: true, message: "No puzzles available. Import and analyze more games first." };
  }

  // Create session and link puzzles
  const session = await createSession(userId);
  for (const puzzle of selected) {
    await addPuzzleToSession(session.id, puzzle.id);
  }

  // Return fully populated session
  return await getSessionById(session.id);
}