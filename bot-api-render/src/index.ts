import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { connectMongo } from "./db/mongoose";
import { initWebSocket } from "./websocket/server";
import { initBot } from "./bot/index";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  // 1. Connect to MongoDB
  await connectMongo();

  // 2. Create HTTP server from Express app
  const httpServer = createServer(app);

  // 3. Attach Socket.IO WebSocket server
  initWebSocket(httpServer);

  // 4. Start the HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, (err?: Error) => {
      if (err) { reject(err); return; }
      logger.info({ port }, "Exontix API server listening");
      resolve();
    });
  });

  // 5. Start the Discord bot
  initBot();
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
