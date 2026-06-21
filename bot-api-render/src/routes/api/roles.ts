import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { LevelRole } from "../../db/models/Level";
import { emitToGuild } from "../../websocket/server";

const router = Router();

router.get("/:guildId/level-roles", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const roles = await LevelRole.find({ guildId }).sort({ level: 1 });
    res.json({ roles });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/update", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId, levelRoles } = req.body as { guildId: string; levelRoles?: Array<{ level: number; roleId: string }> };
    if (!guildId) { res.status(400).json({ error: "guildId required" }); return; }

    if (Array.isArray(levelRoles)) {
      // Replace all level roles for this guild
      await LevelRole.deleteMany({ guildId });
      if (levelRoles.length > 0) {
        await LevelRole.insertMany(levelRoles.map((r) => ({ guildId, ...r })));
      }
    }

    const roles = await LevelRole.find({ guildId }).sort({ level: 1 });
    emitToGuild(guildId, "roles:updated", { levelRoles: roles });
    res.json({ success: true, levelRoles: roles });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
