import { verifyAccessToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No access token provided" });
  }

  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    req.user = payload; // { userId, username, lichessId }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}