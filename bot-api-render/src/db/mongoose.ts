import mongoose from "mongoose";
import { logger } from "../lib/logger";

let isConnected = false;

export async function connectMongo(): Promise<void> {
  if (isConnected) return;

  const uri = process.env["MONGO_URI"];
  if (!uri) throw new Error("MONGO_URI environment variable is required");

  await mongoose.connect(uri);
  isConnected = true;
  logger.info("MongoDB connected");

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected");
  });
}

export { mongoose };
