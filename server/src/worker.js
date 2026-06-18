import dotenv from "dotenv";
import { Worker } from "bullmq";
import { connection } from "./queues/connection.js";
import { ANALYSIS_QUEUE_NAME } from "./queues/analysisQueue.js";

dotenv.config();

const worker = new Worker(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    console.log(`Processing job ${job.id} (${job.name})`, job.data);

    if (job.name === "ping") {
      return { pong: true, receivedAt: new Date().toISOString() };
    }

    if (job.name === "analyze-game") {
      const { gameId, userId } = job.data;
      console.log(`[stub] Would analyze game ${gameId} for user ${userId}`);
      return { analyzed: false, stub: true };
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