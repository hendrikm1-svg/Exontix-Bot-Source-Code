import { type Client, ActivityType } from "discord.js";
import { logger } from "../../lib/logger";
import { Guild } from "../../db/models/Guild";
import { deployCommands } from "../deploy-commands";

function formatNumber(n: number): string {
  return n.toLocaleString("de-DE");
}

function updatePresence(client: Client<true>): void {
  const servers = client.guilds.cache.size;
  const members = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: `Server: ${formatNumber(servers)}  Mitglieder: ${formatNumber(members)}`,
        type: ActivityType.Watching,
      },
    ],
  });
}

export async function onReady(client: Client<true>): Promise<void> {
  const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
  logger.info(
    {
      tag: client.user.tag,
      guilds: client.guilds.cache.size,
      totalMembers,
    },
    "Bot ist bereit",
  );

  // Log all guilds with their member counts
  for (const [, guild] of client.guilds.cache) {
    logger.info(
      { guildId: guild.id, name: guild.name, members: guild.memberCount },
      "Server verbunden",
    );

    await Guild.findOneAndUpdate(
      { guildId: guild.id },
      {
        $set: {
          name: guild.name,
          icon: guild.icon,
          ownerId: guild.ownerId,
          memberCount: guild.memberCount,
        },
        $setOnInsert: { botJoinedAt: new Date() },
      },
      { upsert: true },
    ).catch(() => null);
  }

  updatePresence(client);
  const guildIds = [...client.guilds.cache.keys()];
  await deployCommands(guildIds);
}
