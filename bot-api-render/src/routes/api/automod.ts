import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { Automod } from "../../db/models/Automod";
import { emitToGuild } from "../../websocket/server";

const router = Router();

// Flatten nested DB structure → dashboard flat format
function flatten(doc: ReturnType<typeof Automod.prototype.toObject> | null) {
  if (!doc) return null;
  return {
    _id: doc._id,
    guildId: doc.guildId,
    antiSpam: doc.antiSpam?.enabled ?? false,
    antiRaid: doc.antiRaid?.enabled ?? false,
    antiLink: doc.antiLink?.enabled ?? false,
    antiInvite: doc.antiInvite?.enabled ?? false,
    antiScam: doc.antiScam?.enabled ?? false,
    antiMentionSpam: doc.antiMentionSpam?.enabled ?? false,
    spamThreshold: doc.antiSpam?.threshold ?? 5,
    raidThreshold: doc.antiRaid?.joinThreshold ?? 10,
    maxMentions: doc.antiMentionSpam?.threshold ?? 5,
    ignoredRoles: doc.ignoredRoles ?? [],
    ignoredChannels: doc.ignoredChannels ?? [],
  };
}

// Convert dashboard flat format → nested DB $set
function toNested(data: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  if ("antiSpam" in data) updates["antiSpam.enabled"] = data["antiSpam"];
  if ("antiRaid" in data) updates["antiRaid.enabled"] = data["antiRaid"];
  if ("antiLink" in data) updates["antiLink.enabled"] = data["antiLink"];
  if ("antiInvite" in data) updates["antiInvite.enabled"] = data["antiInvite"];
  if ("antiScam" in data) updates["antiScam.enabled"] = data["antiScam"];
  if ("antiMentionSpam" in data) updates["antiMentionSpam.enabled"] = data["antiMentionSpam"];
  if ("spamThreshold" in data) updates["antiSpam.threshold"] = data["spamThreshold"];
  if ("raidThreshold" in data) updates["antiRaid.joinThreshold"] = data["raidThreshold"];
  if ("maxMentions" in data) updates["antiMentionSpam.threshold"] = data["maxMentions"];
  if ("ignoredRoles" in data) updates["ignoredRoles"] = data["ignoredRoles"];
  if ("ignoredChannels" in data) updates["ignoredChannels"] = data["ignoredChannels"];
  return updates;
}

router.get("/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const automod = await Automod.findOneAndUpdate(
      { guildId },
      { $setOnInsert: { guildId } },
      { upsert: true, new: true },
    );
    res.json(flatten(automod.toObject()));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, ...data } = req.body as { guildId: string; [k: string]: unknown };
    if (!guildId) { res.status(400).json({ error: "guildId required" }); return; }

    const updates = toNested(data);
    const automod = await Automod.findOneAndUpdate(
      { guildId },
      { $set: updates },
      { upsert: true, new: true },
    );

    const flat = flatten(automod.toObject());
    emitToGuild(guildId, "automod:updated", flat);
    res.json({ success: true, automod: flat });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
