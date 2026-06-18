import { pool } from "./pool.js";

export async function storeRefreshToken({ userId, token, expiresAt }) {
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, token, expiresAt]
  );
}

export async function getRefreshToken(token) {
  const { rows } = await pool.query(
    `SELECT rt.*, u.id as user_id, u.username, u.lichess_id, u.weakness_profile
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token = $1 AND rt.expires_at > now()`,
    [token]
  );
  return rows[0] || null;
}

export async function deleteRefreshToken(token) {
  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
}

export async function deleteAllRefreshTokensForUser(userId) {
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
}