import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { Level } from "../../db/models/Level";

const router = Router();

router.get("/:guildId/leaderboard", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const page = Number(req.query["page"] ?? 1);
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);

    const [entries, total] = await Promise.all([
      Level.find({ guildId }).sort({ xp: -1 }).skip((page - 1) * limit).limit(limit),
      Level.countDocuments({ guildId }),
    ]);

    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:guildId/user/:userId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const entry = await Level.findOne({ guildId, userId });
    if (!entry) { res.status(404).json({ error: "User not found" }); return; }
    const rank = await Level.countDocuments({ guildId, xp: { $gt: entry.xp } }) + 1;
    res.json({ ...entry.toObject(), rank });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
