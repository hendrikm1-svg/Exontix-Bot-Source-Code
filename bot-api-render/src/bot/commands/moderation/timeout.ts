import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { LogEntry } from "../../../db/models/Log";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

export const timeoutCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Versetzt ein Mitglied in den Timeout")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer der in den Timeout kommt").setRequired(true))
    .addIntegerOption((o) => o.setName("dauer").setDescription("Dauer in Minuten").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption((o) => o.setName("grund").setDescription("Grund"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const duration = interaction.options.getInteger("dauer", true);
    const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
    const guild = interaction.guild!;

    try {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) { await interaction.editReply({ content: "❌ Nutzer nicht gefunden." }); return; }
      if (!member.moderatable) { await interaction.editReply({ content: "❌ Ich kann diesen Nutzer nicht in den Timeout versetzen." }); return; }

      await member.timeout(duration * 60 * 1000, reason);

      const logEntry = await LogEntry.create({
        guildId: guild.id, type: "mod",
        userId: interaction.user.id, targetId: target.id,
        content: `Timeout ${duration} Minuten: ${reason}`,
      });

      emitToGuild(guild.id, "mod:action", {
        action: "timeout", targetId: target.id,
        moderatorId: interaction.user.id, duration, reason, timestamp: logEntry.createdAt,
      });

      const embed = new EmbedBuilder()
        .setColor(0xf39c12).setTitle("⏱ Mitglied im Timeout")
        .addFields(
          { name: "Nutzer", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Dauer", value: `${duration} Minuten`, inline: true },
          { name: "Grund", value: reason },
        ).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "timeout Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Setzen des Timeouts." });
    }
  },
};
