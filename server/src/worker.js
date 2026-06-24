import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connection } from "./queues/connection.js";
import { ANALYSIS_QUEUE_NAME } from "./queues/analysisQueue.js";
import { analyzeGame } from "./engine/analyzeGame.js";
import { extractBlunders } from "./engine/extractBlunders.js";
import { StockfishEngine } from "./engine/stockfishEngine.js";

dotenv.config();

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
      await engineReady;
      const { gameId, userId } = job.data;

      await engine.reset();
      const analysisResult = await analyzeGame(gameId, engine);
      console.log(`Analyzed game ${gameId}: ${analysisResult.movesAnalyzed} moves`);

      const blunderResult = await extractBlunders(gameId, userId);
      console.log(`Extracted ${blunderResult.blundersExtracted} blunders from game ${gameId}`);

      return { ...analysisResult, ...blunderResult };
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

console.log("Worker started, listening for jobs on: game-analysis");