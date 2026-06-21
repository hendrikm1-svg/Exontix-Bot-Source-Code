import { Events } from "discord.js";
import { botClient } from "./client";
import { commands } from "./commands";
import { onReady } from "./events/ready";
import { onGuildCreate, onGuildDelete } from "./events/guildCreate";
import { onInteractionCreate } from "./events/interactionCreate";
import { onMessageCreate } from "./events/messageCreate";
import { onGuildMemberAdd, onGuildMemberRemove } from "./events/guildMemberAdd";
import { onMessageDelete, onMessageUpdate } from "./events/messageDelete";
import { onVoiceStateUpdate } from "./events/voiceStateUpdate";
import { logger } from "../lib/logger";

export function initBot(): void {
  // Register commands on client
  for (const command of commands) {
    botClient.commands.set(command.data.name, command);
  }

  botClient.once(Events.ClientReady, onReady);
  botClient.on(Events.GuildCreate, onGuildCreate);
  botClient.on(Events.GuildDelete, onGuildDelete);
  botClient.on(Events.InteractionCreate, onInteractionCreate);
  botClient.on(Events.MessageCreate, (msg) => { void onMessageCreate(msg); });
  botClient.on(Events.GuildMemberAdd, (member) => {
    if (!member.partial) void onGuildMemberAdd(member);
  });
  botClient.on(Events.GuildMemberRemove, (member) => {
    if (!member.partial) void onGuildMemberRemove(member);
  });
  botClient.on(Events.MessageDelete, (msg) => { void onMessageDelete(msg); });
  botClient.on(Events.MessageUpdate, (old, newMsg) => { void onMessageUpdate(old, newMsg); });
  botClient.on(Events.VoiceStateUpdate, (old, newState) => { void onVoiceStateUpdate(old, newState); });

  botClient.on(Events.Error, (err) => logger.error({ err }, "Discord client error"));
  botClient.on(Events.Warn, (info) => logger.warn({ info }, "Discord client warning"));

  const token = process.env["DISCORD_TOKEN"];
  if (!token) throw new Error("DISCORD_TOKEN is required");

  void botClient.login(token).then(() => {
    logger.info("Discord bot logged in");
  }).catch((err) => {
    logger.error({ err }, "Failed to login Discord bot");
    process.exit(1);
  });
}
