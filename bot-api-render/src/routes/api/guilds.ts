import { Router } from "express";
import { requireDiscordAuth } from "../../middlewares/auth";
import { Guild } from "../../db/models/Guild";
import { botClient } from "../../bot/client";

const router = Router();

// GET /api/guilds/:userId — get all guilds the bot shares with a user
router.get("/:userId", requireDiscordAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const authUser = (req as typeof req & { discordUser: { id: string } }).discordUser;

    // Only allow users to query their own guilds
    if (authUser.id !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const userGuildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: { Authorization: req.headers["authorization"] as string },
    });

    if (!userGuildsRes.ok) {
      res.status(502).json({ error: "Could not fetch guilds from Discord" });
      return;
    }

    const userGuilds = (await userGuildsRes.json()) as Array<{
      id: string;
      name: string;
      icon: string | null;
      permissions: string;
    }>;

    // Filter to guilds where the bot is also present
    const botGuildIds = new Set(botClient.guilds.cache.map((g) => g.id));
    const sharedGuilds = userGuilds.filter((g) => botGuildIds.has(g.id));

    // Enrich with DB data
    const dbGuilds = await Guild.find({ guildId: { $in: sharedGuilds.map((g) => g.id) } });
    const dbMap = new Map(dbGuilds.map((g) => [g.guildId, g]));

    const result = sharedGuilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
      permissions: g.permissions,
      isAdmin: !!(BigInt(g.permissions) & BigInt(0x8)),
      memberCount: dbMap.get(g.id)?.memberCount ?? null,
      premium: dbMap.get(g.id)?.premium ?? false,
    }));

    res.json({ guilds: result });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
