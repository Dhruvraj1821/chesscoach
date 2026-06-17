import express from "express";
import axios from "axios";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../utils/pkce.js";
import { upsertUser, getUserById } from "../db/users.js";

const router = express.Router();

const LICHESS_HOST = "https://lichess.org";

router.get("/lichess/login", (req, res) => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store in session to validate on callback
  req.session.codeVerifier = codeVerifier;
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LICHESS_CLIENT_ID,
    redirect_uri: process.env.LICHESS_CALLBACK_URL,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
    // No scope needed for identity - /api/account is accessible with any token
  });

  res.redirect(`${LICHESS_HOST}/oauth?${params.toString()}`);
});

// Step 2: Lichess redirects back here with ?code=...&state=...
router.get("/lichess/callback", async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Lichess OAuth error: ${error}` });
  }

  if (!code || !state) {
    return res.status(400).json({ error: "Missing code or state in callback" });
  }

  if (state !== req.session.oauthState) {
    return res.status(400).json({ error: "State mismatch — possible CSRF" });
  }

  const codeVerifier = req.session.codeVerifier;
  if (!codeVerifier) {
    return res.status(400).json({ error: "Missing code verifier in session" });
  }

  // Exchange authorization code for access token
  // MUST be application/x-www-form-urlencoded - Lichess rejects JSON
  const tokenResponse = await axios.post(
    `${LICHESS_HOST}/api/token`,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LICHESS_CALLBACK_URL,
      client_id: process.env.LICHESS_CLIENT_ID,
      code_verifier: codeVerifier,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  const accessToken = tokenResponse.data.access_token;
  if (!accessToken) {
    return res.status(400).json({ error: "No access token returned from Lichess" });
  }

  // Fetch Lichess account info to get user identity
  const accountResponse = await axios.get(`${LICHESS_HOST}/api/account`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const { id: lichessId, username } = accountResponse.data;

  // Upsert user in DB
  const user = await upsertUser({ lichessId, username, accessToken });

  // Clear PKCE temp values, persist login
  delete req.session.codeVerifier;
  delete req.session.oauthState;
  req.session.userId = user.id;

  
  res.redirect("http://localhost:5173/dashboard");
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Failed to log out" });
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const user = await getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }
  res.json({ user });
});

export default router;