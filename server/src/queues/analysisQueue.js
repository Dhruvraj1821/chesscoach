import { Queue } from "bullmq";
import { connection } from "./connection.js";

export const ANALYSIS_QUEUE_NAME = "game-analysis";

export const analysisQueue = new Queue(ANALYSIS_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  },
});