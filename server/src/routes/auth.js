import express from "express";
import axios from "axios";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../utils/pkce.js";
import { generateAccessToken, generateRefreshToken, getRefreshTokenExpiry, verifyAccessToken } from "../utils/jwt.js";
import { upsertUser, getUserById } from "../db/users.js";
import { storeRefreshToken, getRefreshToken, deleteRefreshToken, deleteAllRefreshTokensForUser } from "../db/refreshTokens.js";

const router = express.Router();
const LICHESS_HOST = "https://lichess.org";

// We need a temporary in-memory store for PKCE verifier/state
// since we removed express-session. This is fine — PKCE params
// only need to live for the duration of the OAuth round trip (~seconds)
const pkceStore = new Map();

// Cleanup stale PKCE entries older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [key, value] of pkceStore.entries()) {
    if (value.createdAt < cutoff) pkceStore.delete(key);
  }
}, 5 * 60 * 1000);

function setRefreshTokenCookie(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: "/auth", // only sent to /auth/* routes
  });
}

// GET /auth/lichess/login
router.get("/lichess/login", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  pkceStore.set(state, { codeVerifier, createdAt: Date.now() });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LICHESS_CLIENT_ID,
    redirect_uri: process.env.LICHESS_CALLBACK_URL,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
  });

  res.redirect(`${LICHESS_HOST}/oauth?${params.toString()}`);
});

// GET /auth/lichess/callback
router.get("/lichess/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Lichess OAuth error: ${error}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state in callback" });
  }

  const pkceData = pkceStore.get(state);
  if (!pkceData) {
    return res.status(400).json({ error: "Invalid or expired state — restart login" });
  }

  const { codeVerifier } = pkceData;
  pkceStore.delete(state);

  // Exchange code for Lichess access token
  const tokenResponse = await axios.post(
    `${LICHESS_HOST}/api/token`,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LICHESS_CALLBACK_URL,
      client_id: process.env.LICHESS_CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  const lichessAccessToken = tokenResponse.data.access_token;
  if (!lichessAccessToken) {
    return res.status(400).json({ error: "No access token returned from Lichess" });
  }

  // Get Lichess user identity
  const accountResponse = await axios.get(`${LICHESS_HOST}/api/account`, {
    headers: { Authorization: `Bearer ${lichessAccessToken}` },
  });

  const { id: lichessId, username } = accountResponse.data;

  // Upsert user in our DB
  const user = await upsertUser({ lichessId, username, accessToken: lichessAccessToken });

  // Issue our own tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();

  await storeRefreshToken({ userId: user.id, token: refreshToken, expiresAt });

  // Refresh token goes in httpOnly cookie
  setRefreshTokenCookie(res, refreshToken);

  res.redirect(`http://localhost:5173/auth/callback?accessToken=${accessToken}`);
});

// POST /auth/refresh
// Called by frontend when access token expires (axios interceptor)
router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) {
    return res.status(401).json({ error: "No refresh token" });
  }

  const stored = await getRefreshToken(token);
  if (!stored) {
    return res.status(401).json({ error: "Invalid or expired refresh token" });
  }

  // Rotate refresh token - old one deleted, new one issued
  await deleteRefreshToken(token);
  const newRefreshToken = generateRefreshToken();
  const expiresAt = getRefreshTokenExpiry();
  await storeRefreshToken({ userId: stored.user_id, token: newRefreshToken, expiresAt });
  setRefreshTokenCookie(res, newRefreshToken);

  const user = await getUserById(stored.user_id);
  const accessToken = generateAccessToken(user);

  res.json({ accessToken });
});

// POST /auth/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await deleteRefreshToken(token);
  }
  res.clearCookie("refreshToken", { path: "/auth" });
  res.json({ success: true });
});


router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No access token" });
  }

  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    const user = await getUserById(payload.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user });
  } catch {
    res.status(401).json({ error: "Invalid or expired access token" });
  }
});

export default router;