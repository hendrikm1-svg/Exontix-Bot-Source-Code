import { Router } from "express";
import { requireDiscordAuth, requireGuildAdmin } from "../../middlewares/auth";
import { Guild } from "../../db/models/Guild";
import { botClient } from "../../bot/client";

const router = Router();

// GET /api/guild/:guildId — get guild info + stats
router.get("/:guildId", requireDiscordAuth, requireGuildAdmin, async (req, res) => {
  try {
    const { guildId } = req.params;
    const discordGuild = botClient.guilds.cache.get(guildId as string);

    if (!discordGuild) {
      res.status(404).json({ error: "Bot is not in this guild" });
      return;
    }

    const dbGuild = await Guild.findOne({ guildId });

    res.json({
      id: discordGuild.id,
      name: discordGuild.name,
      icon: discordGuild.iconURL(),
      memberCount: discordGuild.memberCount,
      ownerId: discordGuild.ownerId,
      createdAt: discordGuild.createdAt,
      premium: dbGuild?.premium ?? false,
      botJoinedAt: dbGuild?.botJoinedAt,
      channels: discordGuild.channels.cache
        .filter((c) => c.type === 0 || c.type === 2 || c.type === 4) // text, voice, category
        .map((c) => ({ id: c.id, name: c.name, type: c.type })),
      roles: discordGuild.roles.cache
        .filter((r) => r.id !== discordGuild.id)
        .map((r) => ({ id: r.id, name: r.name, color: r.hexColor, position: r.position }))
        .sort((a, b) => b.position - a.position),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
