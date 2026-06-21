import type { Message, PartialMessage } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { LogConfig, LogEntry } from "../../db/models/Log";
import { emitToGuild } from "../../websocket/server";

export async function onMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;

  const guildId = message.guild.id;

  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);

  const entry = await LogEntry.create({
    guildId, type: "messageDelete",
    userId: message.author?.id,
    channelId: message.channel.id,
    content: message.content?.slice(0, 1000),
  }).catch(() => null);

  emitToGuild(guildId, "log:messageDelete", {
    userId: message.author?.id,
    channelId: message.channel.id,
    content: message.content?.slice(0, 500),
    timestamp: entry?.createdAt ?? new Date(),
  });

  if (logConfig?.messageDelete) {
    const logChannel = message.guild.channels.cache.get(logConfig.messageDelete);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🗑️ Nachricht gelöscht")
        .addFields(
          { name: "Autor", value: message.author ? `${message.author.tag} (${message.author.id})` : "Unbekannt", inline: true },
          { name: "Kanal", value: `<#${message.channel.id}>`, inline: true },
          { name: "Inhalt", value: message.content?.slice(0, 1024) || "*Kein Inhalt*" },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }
}

export async function onMessageUpdate(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const guildId = newMessage.guild.id;

  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);

  const entry = await LogEntry.create({
    guildId, type: "messageEdit",
    userId: newMessage.author?.id,
    channelId: newMessage.channel.id,
    content: newMessage.content?.slice(0, 1000),
    extra: { before: oldMessage.content?.slice(0, 500) },
  }).catch(() => null);

  emitToGuild(guildId, "log:messageEdit", {
    userId: newMessage.author?.id,
    channelId: newMessage.channel.id,
    before: oldMessage.content?.slice(0, 500),
    after: newMessage.content?.slice(0, 500),
    timestamp: entry?.createdAt ?? new Date(),
  });

  if (logConfig?.messageEdit) {
    const logChannel = newMessage.guild.channels.cache.get(logConfig.messageEdit);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle("✏️ Nachricht bearbeitet")
        .addFields(
          { name: "Autor", value: newMessage.author ? newMessage.author.tag : "Unbekannt", inline: true },
          { name: "Kanal", value: `<#${newMessage.channel.id}>`, inline: true },
          { name: "Vorher", value: oldMessage.content?.slice(0, 512) || "*leer*" },
          { name: "Nachher", value: newMessage.content?.slice(0, 512) || "*leer*" },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }
}
