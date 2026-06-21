import type { VoiceState } from "discord.js";
import { EmbedBuilder } from "discord.js";
import { LogConfig, LogEntry } from "../../db/models/Log";
import { emitToGuild } from "../../websocket/server";

export async function onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
  const guild = newState.guild;
  const member = newState.member;
  if (!member) return;

  const guildId = guild.id;
  let action = "";

  if (!oldState.channel && newState.channel) {
    action = `${newState.channel.name} beigetreten`;
  } else if (oldState.channel && !newState.channel) {
    action = `${oldState.channel.name} verlassen`;
  } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
    action = `Von ${oldState.channel.name} nach ${newState.channel.name} gewechselt`;
  } else {
    return;
  }

  const entry = await LogEntry.create({
    guildId, type: "voiceState",
    userId: member.id,
    channelId: newState.channel?.id ?? oldState.channel?.id,
    content: action,
  }).catch(() => null);

  emitToGuild(guildId, "log:voiceState", {
    userId: member.id,
    action,
    timestamp: entry?.createdAt ?? new Date(),
  });

  const logConfig = await LogConfig.findOne({ guildId }).catch(() => null);
  if (!logConfig?.voiceState) return;

  const logChannel = guild.channels.cache.get(logConfig.voiceState);
  if (!logChannel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🎙️ Sprachkanal-Aktivität")
    .setDescription(`${member.user.tag} hat ${action}`)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] }).catch(() => null);
}
