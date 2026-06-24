import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { analysisQueue } from "./queues/analysisQueue.js";
import authRouter from "./routes/auth.js";
import gamesRouter from "./routes/games.js";
import analysisRouter from "./routes/analysis.js";
import puzzlesRouter from "./routes/puzzles.js";
import sessionsRouter from "./routes/sessions.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/games", gamesRouter);
app.use("/analysis", analysisRouter);
app.use("/puzzles", puzzlesRouter);
app.use("/sessions", sessionsRouter);

// Temporary — remove after Step 6
app.post("/test/ping-job", async (req, res) => {
  const job = await analysisQueue.add("ping", { message: "hello from API" });
  res.json({ jobId: job.id });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});