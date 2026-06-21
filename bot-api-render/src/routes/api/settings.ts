import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { Settings } from "../../db/models/Settings";
import { emitToGuild } from "../../websocket/server";

const router = Router();

function toResponse(doc: Record<string, unknown>) {
  return {
    ...doc,
    // Dashboard uses modLogChannelId, DB stores modLogChannel
    modLogChannelId: doc["modLogChannel"] ?? null,
  };
}

function toDb(data: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  if ("prefix" in data) mapped["prefix"] = data["prefix"];
  if ("language" in data) mapped["language"] = data["language"];
  if ("modLogChannelId" in data) mapped["modLogChannel"] = data["modLogChannelId"];
  if ("levelEnabled" in data) mapped["levelEnabled"] = data["levelEnabled"];
  if ("economyEnabled" in data) mapped["economyEnabled"] = data["economyEnabled"];
  if ("aiEnabled" in data) mapped["aiEnabled"] = data["aiEnabled"];
  return mapped;
}

router.get("/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const settings = await Settings.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    res.json(toResponse(settings.toObject() as Record<string, unknown>));
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
    const settings = await Settings.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { upsert: true, new: true },
    );

    const response = toResponse(settings.toObject() as Record<string, unknown>);
    emitToGuild(guildId, "settings:updated", response);
    res.json({ success: true, settings: response });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
