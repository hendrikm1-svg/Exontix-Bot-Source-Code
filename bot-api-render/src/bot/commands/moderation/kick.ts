import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { LogEntry } from "../../../db/models/Log";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

export const kickCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kickt ein Mitglied vom Server")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer der gekickt wird").setRequired(true))
    .addStringOption((o) => o.setName("grund").setDescription("Grund für den Kick"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("grund") ?? "Kein Grund angegeben";
    const guild = interaction.guild!;

    try {
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) { await interaction.editReply({ content: "❌ Nutzer nicht auf diesem Server gefunden." }); return; }
      if (!member.kickable) { await interaction.editReply({ content: "❌ Ich kann diesen Nutzer nicht kicken." }); return; }

      await member.send(`Du wurdest von **${guild.name}** gekickt.\nGrund: ${reason}`).catch(() => null);
      await member.kick(reason);

      const logEntry = await LogEntry.create({
        guildId: guild.id, type: "mod",
        userId: interaction.user.id, targetId: target.id, content: `Gekickt: ${reason}`,
      });

      emitToGuild(guild.id, "mod:action", {
        action: "kick", targetId: target.id,
        moderatorId: interaction.user.id, reason, timestamp: logEntry.createdAt,
      });

      const embed = new EmbedBuilder()
        .setColor(0xe67e22).setTitle("👢 Mitglied gekickt")
        .addFields(
          { name: "Nutzer", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Moderator", value: interaction.user.tag, inline: true },
          { name: "Grund", value: reason },
        ).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "kick Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Kicken des Nutzers." });
    }
  },
};
