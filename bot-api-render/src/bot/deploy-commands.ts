import { REST, Routes } from "discord.js";
import { logger } from "../lib/logger";
import { commands } from "./commands";

export async function deployCommands(guildIds: string[] = []): Promise<void> {
  const token = process.env["DISCORD_TOKEN"];
  const clientId = process.env["CLIENT_ID"];

  if (!token || !clientId) {
    logger.warn("Missing DISCORD_TOKEN or CLIENT_ID — skipping command deploy");
    return;
  }

  const rest = new REST().setToken(token);
  const commandData = commands.map((cmd) => cmd.data.toJSON());

  // Register to each guild immediately (instant propagation, no waiting)
  if (guildIds.length > 0) {
    logger.info(`Registering ${commandData.length} slash commands to ${guildIds.length} guilds (instant)...`);
    await Promise.all(
      guildIds.map((guildId) =>
        rest
          .put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData })
          .catch((err) => logger.error({ err, guildId }, "Failed to register guild commands")),
      ),
    );
    logger.info("Guild slash commands registered successfully");
  }

  // Also register globally so new guilds get commands automatically
  try {
    logger.info("Registering slash commands globally (background, up to 1h propagation)...");
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    logger.info("Global slash commands registered successfully");
  } catch (err) {
    logger.error({ err }, "Failed to register global slash commands");
  }
}
