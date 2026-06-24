import { pool } from "./pool.js";

export async function getTodaysSession(userId) {
  const { rows } = await pool.query(
    `SELECT s.*, 
       json_agg(
         json_build_object(
           'session_puzzle_id', sp.id,
           'puzzle_id', sp.puzzle_id,
           'solved', sp.solved,
           'attempts', sp.attempts,
           'time_taken_seconds', sp.time_taken_seconds,
           'fen', p.fen,
           'solution_uci', p.solution_uci,
           'theme', p.theme,
           'difficulty', p.difficulty
         ) ORDER BY sp.id
       ) as puzzles
     FROM sessions s
     JOIN session_puzzles sp ON sp.session_id = s.id
     JOIN puzzles p ON p.id = sp.puzzle_id
     WHERE s.user_id = $1 AND s.date = CURRENT_DATE
     GROUP BY s.id`,
    [userId]
  );
  return rows[0] || null;
}

export async function createSession(userId) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, date, puzzles_attempted, puzzles_solved, session_type)
     VALUES ($1, CURRENT_DATE, 0, 0, 'daily')
     RETURNING *`,
    [userId]
  );
  return rows[0];
}

export async function addPuzzleToSession(sessionId, puzzleId) {
  const { rows } = await pool.query(
    `INSERT INTO session_puzzles (session_id, puzzle_id, attempts)
     VALUES ($1, $2, 0)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [sessionId, puzzleId]
  );
  return rows[0] || null;
}

export async function updateSessionProgress(sessionId, { puzzlesAttempted, puzzlesSolved }) {
  await pool.query(
    `UPDATE sessions
     SET puzzles_attempted = $1, puzzles_solved = $2
     WHERE id = $3`,
    [puzzlesAttempted, puzzlesSolved, sessionId]
  );
}

export async function recordPuzzleAttempt(sessionPuzzleId, { solved, attempts, timeTakenSeconds }) {
  await pool.query(
    `UPDATE session_puzzles
     SET solved = $1, attempts = $2, time_taken_seconds = $3
     WHERE id = $4`,
    [solved, attempts, timeTakenSeconds, sessionPuzzleId]
  );
}

export async function getSessionById(sessionId) {
  const { rows } = await pool.query(
    `SELECT s.*,
       json_agg(
         json_build_object(
           'session_puzzle_id', sp.id,
           'puzzle_id', sp.puzzle_id,
           'solved', sp.solved,
           'attempts', sp.attempts,
           'time_taken_seconds', sp.time_taken_seconds,
           'fen', p.fen,
           'solution_uci', p.solution_uci,
           'theme', p.theme,
           'difficulty', p.difficulty
         ) ORDER BY sp.id
       ) as puzzles
     FROM sessions s
     JOIN session_puzzles sp ON sp.session_id = s.id
     JOIN puzzles p ON p.id = sp.puzzle_id
     WHERE s.id = $1
     GROUP BY s.id`,
    [sessionId]
  );
  return rows[0] || null;
}