import { pool } from "../db/pool.js";

/**
 * Aggregates all blunders for a user across all analyzed games
 * and computes a structured weakness profile.
 * Writes the result to users.weakness_profile JSONB.
 */
export async function computeWeaknessProfile(userId) {
  // Single query — pull everything we need in one round trip
  const { rows } = await pool.query(
    `SELECT
       b.tactical_theme,
       b.game_phase,
       m.centipawn_loss,
       m.classification
     FROM blunders b
     JOIN moves m ON m.id = b.move_id
     WHERE b.user_id = $1
       AND m.centipawn_loss IS NOT NULL`,
    [userId]
  );

  if (rows.length === 0) {
    return { error: "No blunders found for user" };
  }

  // Count analyzed games
  const { rows: gameRows } = await pool.query(
    `SELECT COUNT(*) as count FROM games WHERE user_id = $1 AND analyzed = true`,
    [userId]
  );
  const totalGamesAnalyzed = parseInt(gameRows[0].count);

  // Aggregate by theme
  const themeMap = {};
  const phaseMap = { opening: { blunders: 0, total_cp: 0 }, middlegame: { blunders: 0, total_cp: 0 }, endgame: { blunders: 0, total_cp: 0 } };

  for (const row of rows) {
    const theme = row.tactical_theme || "missed_tactic";
    const phase = row.game_phase || "middlegame";
    const cp = parseInt(row.centipawn_loss) || 0;

    // By theme
    if (!themeMap[theme]) {
      themeMap[theme] = { count: 0, total_cp: 0, phases: { opening: 0, middlegame: 0, endgame: 0 } };
    }
    themeMap[theme].count++;
    themeMap[theme].total_cp += cp;
    themeMap[theme].phases[phase] = (themeMap[theme].phases[phase] || 0) + 1;

    // By phase
    phaseMap[phase].blunders++;
    phaseMap[phase].total_cp += cp;
  }

  // Build top_themes sorted by count desc
  const topThemes = Object.entries(themeMap)
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      avg_centipawn_loss: Math.round(data.total_cp / data.count),
    }))
    .sort((a, b) => b.count - a.count);

  // Build by_theme with full breakdown
  const byTheme = {};
  for (const [theme, data] of Object.entries(themeMap)) {
    byTheme[theme] = {
      count: data.count,
      avg_centipawn_loss: Math.round(data.total_cp / data.count),
      phases: data.phases,
    };
  }

  // Build by_phase
  const byPhase = {};
  for (const [phase, data] of Object.entries(phaseMap)) {
    byPhase[phase] = {
      blunders: data.blunders,
      avg_centipawn_loss: data.blunders > 0 ? Math.round(data.total_cp / data.blunders) : 0,
    };
  }

  // Worst phase = most blunders
  const worstPhase = Object.entries(byPhase)
    .sort((a, b) => b[1].blunders - a[1].blunders)[0][0];

  // Worst theme = highest count
  const worstTheme = topThemes[0]?.theme || "missed_tactic";

  const profile = {
    total_blunders: rows.length,
    total_games_analyzed: totalGamesAnalyzed,
    top_themes: topThemes,
    by_phase: byPhase,
    by_theme: byTheme,
    worst_phase: worstPhase,
    worst_theme: worstTheme,
    computed_at: new Date().toISOString(),
  };

  // Write to DB
  await pool.query(
    `UPDATE users SET weakness_profile = $1 WHERE id = $2`,
    [JSON.stringify(profile), userId]
  );

  return profile;
}