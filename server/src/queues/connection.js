import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

export const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on("error", (err) => {
  console.error("Redis connection error:", err);
});