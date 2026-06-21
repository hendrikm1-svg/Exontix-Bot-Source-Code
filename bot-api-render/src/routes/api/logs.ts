import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { LogConfig, LogEntry } from "../../db/models/Log";
import { emitToGuild } from "../../websocket/server";

const router = Router();

// DB field names → dashboard field names
function toResponse(doc: Record<string, unknown>) {
  return {
    ...doc,
    messageDeleteChannelId: doc["messageDelete"] ?? null,
    messageEditChannelId: doc["messageEdit"] ?? null,
    memberJoinChannelId: doc["memberJoin"] ?? null,
    memberLeaveChannelId: doc["memberLeave"] ?? null,
    voiceStateChannelId: doc["voiceState"] ?? null,
    modActionChannelId: doc["modActions"] ?? null,
  };
}

// Dashboard field names → DB field names
function toDb(data: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  if ("messageDeleteChannelId" in data) mapped["messageDelete"] = data["messageDeleteChannelId"];
  if ("messageEditChannelId" in data) mapped["messageEdit"] = data["messageEditChannelId"];
  if ("memberJoinChannelId" in data) mapped["memberJoin"] = data["memberJoinChannelId"];
  if ("memberLeaveChannelId" in data) mapped["memberLeave"] = data["memberLeaveChannelId"];
  if ("voiceStateChannelId" in data) mapped["voiceState"] = data["voiceStateChannelId"];
  if ("modActionChannelId" in data) mapped["modActions"] = data["modActionChannelId"];
  return mapped;
}

router.get("/config/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const config = await LogConfig.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    res.json(toResponse(config.toObject() as Record<string, unknown>));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/config/update", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, ...data } = req.body as { guildId: string; [k: string]: unknown };
    if (!guildId) { res.status(400).json({ error: "guildId required" }); return; }

    const updates = toDb(data);
    const config = await LogConfig.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { upsert: true, new: true },
    );

    const response = toResponse(config.toObject() as Record<string, unknown>);
    emitToGuild(guildId, "logs:config-updated", response);
    res.json({ success: true, config: response });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const page = Number(req.query["page"] ?? 1);
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const typeParam = req.query["type"];
    const rawType = typeof typeParam === "string" ? typeParam
      : Array.isArray(typeParam) && typeof typeParam[0] === "string" ? typeParam[0] as string
      : undefined;

    const validTypes = ["messageDelete", "messageEdit", "memberJoin", "memberLeave", "voiceState", "mod", "automod"] as const;
    type LogType = (typeof validTypes)[number];
    const typedType: LogType | undefined = rawType && (validTypes as readonly string[]).includes(rawType)
      ? (rawType as LogType)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { guildId };
    if (typedType) query["type"] = typedType;

    const [logs, total] = await Promise.all([
      LogEntry.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      LogEntry.countDocuments(query),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
