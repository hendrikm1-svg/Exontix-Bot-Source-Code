import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Economy } from "../../../db/models/Economy";
import { logger } from "../../../lib/logger";

export const balanceCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("guthaben")
    .setDescription("Zeigt dein Münzguthaben an")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer dessen Guthaben angezeigt wird")) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;

    try {
      const eco = await Economy.findOneAndUpdate(
        { guildId: interaction.guild!.id, userId: target.id },
        { $setOnInsert: { guildId: interaction.guild!.id, userId: target.id } },
        { upsert: true, new: true },
      );

      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(`💰 ${target.tag}'s Guthaben`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Portemonnaie", value: `🪙 ${eco.balance.toLocaleString("de-DE")} Münzen`, inline: true },
          { name: "Bank", value: `🏦 ${eco.bank.toLocaleString("de-DE")} Münzen`, inline: true },
          { name: "Gesamt", value: `${(eco.balance + eco.bank).toLocaleString("de-DE")} Münzen` },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "guthaben Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Laden des Guthabens." });
    }
  },
};
