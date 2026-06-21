import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Warning } from "../../../db/models/Moderation";
import { emitToGuild } from "../../../websocket/server";
import { logger } from "../../../lib/logger";

export const unwarnCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Entfernt eine Verwarnung von einem Mitglied")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer dessen Verwarnung entfernt wird").setRequired(true))
    .addStringOption((o) => o.setName("verwarn_id").setDescription("Verwarnungs-ID (leer lassen für neueste)"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser("user", true);
    const warnId = interaction.options.getString("verwarn_id");
    const guild = interaction.guild!;

    try {
      let removed;
      if (warnId) {
        removed = await Warning.findOneAndUpdate(
          { _id: warnId, guildId: guild.id, userId: target.id },
          { active: false },
          { new: true },
        );
      } else {
        removed = await Warning.findOneAndUpdate(
          { guildId: guild.id, userId: target.id, active: true },
          { active: false },
          { sort: { createdAt: -1 }, new: true },
        );
      }

      if (!removed) {
        await interaction.editReply({ content: "❌ Keine aktive Verwarnung gefunden." });
        return;
      }

      emitToGuild(guild.id, "mod:unwarn", { targetId: target.id, warnId: removed._id });

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71).setTitle("✅ Verwarnung entfernt")
        .addFields(
          { name: "Nutzer", value: target.tag, inline: true },
          { name: "Verwarnung", value: removed.reason, inline: true },
        ).setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "unwarn Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Entfernen der Verwarnung." });
    }
  },
};
