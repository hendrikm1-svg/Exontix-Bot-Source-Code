import { Server as HttpServer } from "http";
import { Server as IOServer, type Socket } from "socket.io";
import { logger } from "../lib/logger";

let io: IOServer | null = null;

export function initWebSocket(httpServer: HttpServer): IOServer {
  const wsSecret = process.env["WS_SECRET"];

  io = new IOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Auth middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token || token !== wsSecret) {
      return next(new Error("Unauthorized"));
    }
    next();
  });

  io.on("connection", (socket: Socket) => {
    const guildId = socket.handshake.query["guildId"] as string | undefined;

    if (guildId) {
      void socket.join(`guild:${guildId}`);
      logger.info({ guildId, socketId: socket.id }, "Dashboard connected");
    }

    socket.on("subscribe:guild", (id: string) => {
      void socket.join(`guild:${id}`);
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Dashboard disconnected");
    });
  });

  logger.info("WebSocket server initialized");
  return io;
}

export function getIO(): IOServer {
  if (!io) throw new Error("WebSocket server not initialized");
  return io;
}

// Emit to all dashboard clients subscribed to a guild
export function emitToGuild(guildId: string, event: string, data: unknown): void {
  if (!io) return;
  io.to(`guild:${guildId}`).emit(event, data);
}

// Broadcast to ALL connected dashboard clients
export function broadcast(event: string, data: unknown): void {
  if (!io) return;
  io.emit(event, data);
}
