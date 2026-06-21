import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Warning } from "../../../db/models/Moderation";
import { LogEntry } from "../../../db/models/Log";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

export const warnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Verwarnt ein Mitglied")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer der verwarnt wird").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund für die Verwarnung").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("grund", true);
    const guild = interaction.guild!;

    try {
      await Warning.create({
        guildId: guild.id, userId: target.id,
        moderatorId: interaction.user.id, reason,
      });

      const warnCount = await Warning.countDocuments({ guildId: guild.id, userId: target.id, active: true });

      const logEntry = await LogEntry.create({
        guildId: guild.id, type: "mod",
        userId: interaction.user.id, targetId: target.id,
        content: `Verwarnung (#${warnCount}): ${reason}`,
      });

      emitToGuild(guild.id, "mod:action", {
        action: "warn", targetId: target.id,
        moderatorId: interaction.user.id, reason, warnCount, timestamp: logEntry.createdAt,
      });

      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member) {
        await member.send(`Du hast Verwarnung #${warnCount} auf **${guild.name}** erhalten: ${reason}`).catch(() => null);
      }

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f).setTitle("⚠️ Mitglied verwarnt")
        .addFields(
          { name: "Nutzer", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Verwarnungen gesamt", value: String(warnCount), inline: true },
          { name: "Grund", value: reason },
        ).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "warn Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Verwarnen des Nutzers." });
    }
  },
};
