import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { Welcome } from "../../db/models/Welcome";
import { emitToGuild } from "../../websocket/server";

const router = Router();

function toResponse(doc: Record<string, unknown>) {
  return {
    ...doc,
    // Dashboard uses message/showAvatar, DB stores embedDescription/embedThumbnail
    message: doc["embedDescription"] ?? "Willkommen auf dem Server, {user}!",
    showAvatar: doc["embedThumbnail"] ?? true,
  };
}

function toDb(data: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  if ("enabled" in data) mapped["enabled"] = data["enabled"];
  if ("channelId" in data) mapped["channelId"] = data["channelId"];
  if ("embedColor" in data) mapped["embedColor"] = data["embedColor"];
  if ("message" in data) mapped["embedDescription"] = data["message"];
  if ("showAvatar" in data) mapped["embedThumbnail"] = data["showAvatar"];
  return mapped;
}

router.get("/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const welcome = await Welcome.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    res.json(toResponse(welcome.toObject() as Record<string, unknown>));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, ...data } = req.body as { guildId: string; [k: string]: unknown };
    if (!guildId) { res.status(400).json({ error: "guildId required" }); return; }

    const updates = toDb(data);
    const welcome = await Welcome.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { upsert: true, new: true },
    );

    const response = toResponse(welcome.toObject() as Record<string, unknown>);
    emitToGuild(guildId, "welcome:updated", response);
    res.json({ success: true, welcome: response });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
