import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connection } from "./queues/connection.js";
import { ANALYSIS_QUEUE_NAME } from "./queues/analysisQueue.js";
import { analyzeGame } from "./engine/analyzeGame.js";
import { StockfishEngine } from "./engine/stockfishEngine.js";

dotenv.config();

// Single shared Stockfish instance for the lifetime of this worker process.
// The stockfish npm package's WASM module cannot be safely re-instantiated
// multiple times in one Node process, so we start it once and reset
// its internal state between games via `reset()`.
const engine = new StockfishEngine();
let engineReady = engine.start();

const worker = new Worker(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    console.log(`Processing job ${job.id} (${job.name})`, job.data);

    if (job.name === "ping") {
      return { pong: true, receivedAt: new Date().toISOString() };
    }

    if (job.name === "analyze-game") {
      await engineReady; // make sure engine finished starting
      const { gameId } = job.data;
      await engine.reset();
      const result = await analyzeGame(gameId, engine);
      console.log(`Analyzed game ${gameId}: ${result.movesAnalyzed} moves`);
      return result;
    }

    throw new Error(`Unknown job type: ${job.name}`);
  },
  { connection, concurrency: 1 }
);

worker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log("Worker started, listening for jobs on:", ANALYSIS_QUEUE_NAME);