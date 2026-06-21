import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { LogEntry } from "../../../db/models/Log";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

export const banCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannt ein Mitglied vom Server")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer der gebannt wird").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund für den Bann"))
    .addIntegerOption((o) =>
      o.setName("nachrichten_loeschen").setDescription("Tage an Nachrichten löschen (0-7)").setMinValue(0).setMaxValue(7),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
    const deleteDays = interaction.options.getInteger("nachrichten_loeschen") ?? 0;
    const guild = interaction.guild!;

    try {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (member) {
        if (!member.bannable) {
          await interaction.editReply({ content: "❌ Ich kann diesen Nutzer nicht bannen (fehlende Berechtigung oder höhere Rolle)." });
          return;
        }
        await member.send(`Du wurdest von **${guild.name}** gebannt.\nGrund: ${reason}`).catch(() => null);
      }

      await guild.bans.create(target.id, { reason, deleteMessageDays: deleteDays });

      const logEntry = await LogEntry.create({
        guildId: guild.id,
        type: "mod",
        userId: interaction.user.id,
        targetId: target.id,
        content: `Gebannt: ${reason}`,
      });

      emitToGuild(guild.id, "mod:action", {
        action: "ban",
        targetId: target.id,
        moderatorId: interaction.user.id,
        reason,
        timestamp: logEntry.createdAt,
      });

      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle("🔨 Mitglied gebannt")
        .addFields(
          { name: "Nutzer", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Grund", value: reason },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "ban Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Bannen des Nutzers." });
    }
  },
};
