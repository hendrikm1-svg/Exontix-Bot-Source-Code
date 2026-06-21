import type { GuildMember } from "discord.js";
import { EmbedBuilder, Colors } from "discord.js";
import { logger } from "../../lib/logger";
import { Welcome } from "../../db/models/Welcome";
import { LogEntry, LogConfig } from "../../db/models/Log";
import { Guild } from "../../db/models/Guild";
import { Automod } from "../../db/models/Automod";
import { emitToGuild } from "../../websocket/server";

// Anti-Raid: track join timestamps per guild
const raidMap = new Map<string, { joins: number[]; warned: boolean }>();

async function checkAntiRaid(member: GuildMember): Promise<boolean> {
  const guildId = member.guild.id;
  const automod = await Automod.findOne({ guildId }).catch(() => null);

  if (!automod?.antiRaid?.enabled) return false;

  const threshold = automod.antiRaid.joinThreshold;
  const interval = automod.antiRaid.joinInterval;
  const action = automod.antiRaid.action;
  const now = Date.now();

  if (!raidMap.has(guildId)) {
    raidMap.set(guildId, { joins: [], warned: false });
    // Clear after interval * 2 to avoid memory leak
    setTimeout(() => raidMap.delete(guildId), interval * 2);
  }

  const entry = raidMap.get(guildId)!;
  entry.joins.push(now);
  // Keep only joins within the time window
  entry.joins = entry.joins.filter((t) => now - t < interval);

  if (entry.joins.length < threshold) return false;

  // Raid detected!
  logger.warn({ guildId, joins: entry.joins.length, threshold }, "Anti-Raid ausgelöst");

  emitToGuild(guildId, "automod:triggered", {
    trigger: "Anti-Raid",
    action,
    userId: member.id,
    channelId: null,
    timestamp: new Date(),
  });

  // Log to configured log channel
  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);
  const logChannelId = logConfig?.memberJoin ?? logConfig?.modActions;
  if (logChannelId) {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(Colors.DarkRed)
        .setTitle("🚨 Anti-Raid ausgelöst!")
        .setDescription(
          `**${entry.joins.length}** Mitglieder sind in den letzten **${interval / 1000}s** beigetreten.\n` +
          `Schwellenwert: ${threshold} Joins/${interval / 1000}s\n` +
          `Aktion: **${action}**`,
        )
        .addFields({ name: "Aktuelles Mitglied", value: `${member.user.tag} (${member.id})` })
        .setTimestamp();
      logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  // Take action on the joining member
  if (action === "kick" && member.kickable) {
    await member.kick("Anti-Raid: Zu viele Beitritte").catch(() => null);
    return true;
  } else if (action === "ban" && member.bannable) {
    await member.ban({ reason: "Anti-Raid: Zu viele Beitritte" }).catch(() => null);
    return true;
  } else if ((action as string) === "timeout" && member.moderatable) {
    // 10-Minuten Timeout
    await member.timeout(10 * 60 * 1000, "Anti-Raid: Zu viele Beitritte").catch(() => null);
  }

  return false;
}

export async function onGuildMemberAdd(member: GuildMember): Promise<void> {
  const guildId = member.guild.id;

  await Guild.findOneAndUpdate({ guildId }, { $set: { memberCount: member.guild.memberCount } }).catch(() => null);

  emitToGuild(guildId, "member:join", {
    userId: member.id,
    username: member.user.tag,
    memberCount: member.guild.memberCount,
  });

  // Anti-Raid check — if member was actioned, skip welcome
  const wasActioned = await checkAntiRaid(member);
  if (wasActioned) return;

  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);
  if (logConfig?.memberJoin) {
    const logChannel = member.guild.channels.cache.get(logConfig.memberJoin);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("📥 Mitglied beigetreten")
        .setDescription(`${member.user.tag} (${member.id})`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: "Account erstellt", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "Mitglieder gesamt", value: member.guild.memberCount.toLocaleString("de-DE"), inline: true },
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  await LogEntry.create({ guildId, type: "memberJoin", userId: member.id }).catch(() => null);

  const welcome = await Welcome.findOne({ guildId }).catch(() => null);
  if (!welcome?.enabled || !welcome.channelId) return;

  const channel = member.guild.channels.cache.get(welcome.channelId);
  if (!channel?.isTextBased()) return;

  const replacePlaceholders = (text: string) =>
    text
      .replace(/{user}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username)
      .replace(/{server}/g, member.guild.name)
      .replace(/{count}/g, member.guild.memberCount.toLocaleString("de-DE"));

  if (welcome.embedEnabled) {
    const embed = new EmbedBuilder()
      .setColor(parseInt(welcome.embedColor.replace("#", ""), 16))
      .setTitle(replacePlaceholders(welcome.embedTitle))
      .setDescription(replacePlaceholders(welcome.embedDescription));

    if (welcome.embedThumbnail) embed.setThumbnail(member.user.displayAvatarURL());
    if (welcome.embedFooter) embed.setFooter({ text: replacePlaceholders(welcome.embedFooter) });
    embed.setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => null);
  }

  if (welcome.dmEnabled && welcome.dmMessage) {
    await member.send(replacePlaceholders(welcome.dmMessage)).catch(() => null);
  }
}

export async function onGuildMemberRemove(member: GuildMember): Promise<void> {
  const guildId = member.guild.id;

  await Guild.findOneAndUpdate({ guildId }, { $set: { memberCount: member.guild.memberCount } }).catch(() => null);

  emitToGuild(guildId, "member:leave", {
    userId: member.id,
    username: member.user.tag,
    memberCount: member.guild.memberCount,
  });

  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);
  if (logConfig?.memberLeave) {
    const logChannel = member.guild.channels.cache.get(logConfig.memberLeave);
    if (logChannel?.isTextBased()) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("📤 Mitglied hat den Server verlassen")
        .setDescription(`${member.user.tag} (${member.id})`)
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await logChannel.send({ embeds: [embed] }).catch(() => null);
    }
  }

  await LogEntry.create({ guildId, type: "memberLeave", userId: member.id }).catch(() => null);
}
