import { pool } from "./pool.js";

export async function upsertUser({ lichessId, username, accessToken }) {
  const { rows } = await pool.query(
    `INSERT INTO users (lichess_id, username, access_token)
     VALUES ($1, $2, $3)
     ON CONFLICT (lichess_id)
     DO UPDATE SET username = EXCLUDED.username, access_token = EXCLUDED.access_token
     RETURNING id, lichess_id, username, weakness_profile, created_at`,
    [lichessId, username, accessToken]
  );
  return rows[0];
}

export async function getUserById(id) {
  const { rows } = await pool.query(
    `SELECT id, lichess_id, username, weakness_profile, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}


export async function getUserWithTokenById(id) {
  const { rows } = await pool.query(
    `SELECT id, lichess_id, username, access_token, weakness_profile, created_at FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}