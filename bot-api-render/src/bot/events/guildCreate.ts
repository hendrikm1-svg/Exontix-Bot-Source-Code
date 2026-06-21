import type { Guild } from "discord.js";
import { logger } from "../../lib/logger";
import { Guild as GuildModel } from "../../db/models/Guild";
import { deployCommands } from "../deploy-commands";

export async function onGuildCreate(guild: Guild): Promise<void> {
  logger.info({ guildId: guild.id, name: guild.name }, "Bot joined guild");

  await GuildModel.findOneAndUpdate(
    { guildId: guild.id },
    {
      $set: {
        name: guild.name,
        icon: guild.icon,
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
        botJoinedAt: new Date(),
      },
    },
    { upsert: true },
  ).catch(() => null);
}

export async function onGuildDelete(guild: Guild): Promise<void> {
  logger.info({ guildId: guild.id }, "Bot left guild");
}
