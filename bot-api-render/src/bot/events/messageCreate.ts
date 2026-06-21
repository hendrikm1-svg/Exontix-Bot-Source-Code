import type { Message } from "discord.js";
import { logger } from "../../lib/logger";
import { Automod } from "../../db/models/Automod";
import { Level, LevelRole } from "../../db/models/Level";
import { Settings } from "../../db/models/Settings";
import { LogEntry } from "../../db/models/Log";
import { Warning } from "../../db/models/Moderation";
import { Ticket } from "../../db/models/Ticket";
import { emitToGuild } from "../../websocket/server";
import { handleTicketAI } from "../ai/ticketAssistant";

const spamMap = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();
const mentionMap = new Map<string, { count: number; timer: ReturnType<typeof setTimeout> }>();

const LINK_REGEX = /https?:\/\/[^\s]+/gi;
const INVITE_REGEX = /discord\.(gg|com\/invite)\/[a-zA-Z0-9-]+/gi;
const SCAM_KEYWORDS = ["free nitro", "discord nitro free", "claim your nitro", "steamcommunity.com/gift"];

function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level));
}

export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // Check if message is in a ticket channel for AI assistance
  const isTicketChannel = await Ticket.exists({
    guildId,
    channelId: message.channel.id,
    status: "open",
  }).catch(() => null);

  if (isTicketChannel) {
    // Fire and forget — don't block other processing
    handleTicketAI(message).catch((err) => logger.error({ err }, "Ticket AI Fehler"));
  }

  const automod = await Automod.findOne({ guildId }).catch(() => null);
  const settings = await Settings.findOne({ guildId }).catch(() => null);

  if (automod) {
    const memberRoles = message.member?.roles.cache.map((r) => r.id) ?? [];
    const isIgnored =
      automod.ignoredChannels.includes(message.channel.id) ||
      memberRoles.some((r) => automod.ignoredRoles.includes(r));

    if (!isIgnored) {
      if (automod.antiSpam?.enabled) {
        const key = `${guildId}:${userId}`;
        const entry = spamMap.get(key) ?? { count: 0, timer: setTimeout(() => spamMap.delete(key), automod.antiSpam.interval) };
        entry.count++;
        spamMap.set(key, entry);

        if (entry.count >= automod.antiSpam.threshold) {
          clearTimeout(entry.timer);
          spamMap.delete(key);
          await handleAutomodAction(message, "Spam", automod.antiSpam.action, guildId);
        }
      }

      if (automod.antiLink?.enabled && LINK_REGEX.test(message.content)) {
        const isWhitelisted = automod.antiLink.whitelist.some((w) => message.content.includes(w));
        if (!isWhitelisted) {
          await handleAutomodAction(message, "unerlaubter Link", automod.antiLink.action, guildId);
        }
      }

      if (automod.antiInvite?.enabled && INVITE_REGEX.test(message.content)) {
        await handleAutomodAction(message, "Discord-Einladung", automod.antiInvite.action, guildId);
      }

      if (automod.antiScam?.enabled) {
        const lower = message.content.toLowerCase();
        if (SCAM_KEYWORDS.some((k) => lower.includes(k))) {
          await handleAutomodAction(message, "Scam-Nachricht", "ban", guildId);
        }
      }

      if (automod.antiMentionSpam?.enabled) {
        const mentionCount = message.mentions.users.size + message.mentions.roles.size;
        if (mentionCount > 0) {
          const key = `${guildId}:${userId}:mention`;
          const entry = mentionMap.get(key) ?? { count: 0, timer: setTimeout(() => mentionMap.delete(key), 10000) };
          entry.count += mentionCount;
          mentionMap.set(key, entry);

          if (entry.count >= automod.antiMentionSpam.threshold) {
            clearTimeout(entry.timer);
            mentionMap.delete(key);
            await handleAutomodAction(message, "Mention-Spam", automod.antiMentionSpam.action, guildId);
          }
        }
      }
    }
  }

  if (settings?.levelEnabled !== false) {
    try {
      const XP_GAIN = Math.floor(Math.random() * 10) + 15;

      const levelData = await Level.findOneAndUpdate(
        { guildId, userId },
        { $inc: { xp: XP_GAIN, totalMessages: 1 } },
        { upsert: true, new: true },
      );

      const xpNeeded = xpForNextLevel(levelData.level);
      if (levelData.xp >= xpNeeded) {
        levelData.level += 1;
        levelData.xp = 0;
        await levelData.save();

        const levelUpChannel = settings?.levelUpChannel;
        if (levelUpChannel) {
          const lvlChannel = message.guild.channels.cache.get(levelUpChannel);
          if (lvlChannel?.isTextBased() && "send" in lvlChannel) {
            await (lvlChannel as { send: (content: string) => Promise<unknown> })
              .send(`🎉 Glückwunsch <@${userId}>! Du hast **Level ${levelData.level}** erreicht!`)
              .catch(() => null);
          }
        }

        const levelRoles = await LevelRole.find({ guildId, level: { $lte: levelData.level } }).sort({ level: -1 });
        if (levelRoles.length > 0 && message.member) {
          for (const lr of levelRoles) {
            const role = message.guild.roles.cache.get(lr.roleId);
            if (role && !message.member.roles.cache.has(lr.roleId)) {
              await message.member.roles.add(role).catch(() => null);
            }
          }
        }

        emitToGuild(guildId, "level:up", { userId, level: levelData.level });
      }
    } catch (err) {
      logger.error({ err }, "Leveling Fehler");
    }
  }
}

async function handleAutomodAction(
  message: Message,
  trigger: string,
  action: string,
  guildId: string,
): Promise<void> {
  try {
    await message.delete().catch(() => null);

    const entry = await LogEntry.create({
      guildId,
      type: "automod",
      userId: message.author.id,
      channelId: message.channel.id,
      content: message.content.slice(0, 500),
      extra: { trigger, action },
    });

    emitToGuild(guildId, "automod:triggered", {
      trigger, action,
      userId: message.author.id,
      channelId: message.channel.id,
      timestamp: entry.createdAt,
    });

    if (action === "warn") {
      await Warning.create({
        guildId, userId: message.author.id,
        moderatorId: message.client.user!.id,
        reason: `Automod: ${trigger}`,
      });
      if ("send" in message.channel) {
        await (message.channel as { send: (content: string) => Promise<{ delete: () => Promise<unknown> }> })
          .send(`⚠️ <@${message.author.id}> Deine Nachricht wurde entfernt (${trigger}).`)
          .then((m) => { setTimeout(() => m.delete().catch(() => null), 5000); })
          .catch(() => null);
      }
    } else if (action === "kick") {
      const member = message.member;
      if (member?.kickable) await member.kick(`Automod: ${trigger}`).catch(() => null);
    } else if (action === "ban") {
      const member = message.member;
      if (member?.bannable) await member.ban({ reason: `Automod: ${trigger}` }).catch(() => null);
    }
  } catch (err) {
    logger.error({ err }, "Automod Aktion Fehler");
  }
}
