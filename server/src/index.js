import "express-async-errors";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import { analysisQueue } from "./queues/analysisQueue.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,     
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7, 
    },
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);


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