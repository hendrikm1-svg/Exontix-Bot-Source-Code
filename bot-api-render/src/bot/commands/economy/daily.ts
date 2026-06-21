import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Economy } from "../../../db/models/Economy";
import { logger } from "../../../lib/logger";

const DAILY_AMOUNT = 200;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export const dailyCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("taeglich")
    .setDescription("Hole deine tägliche Münzbelohnung ab") as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const eco = await Economy.findOneAndUpdate(
        { guildId: interaction.guild!.id, userId: interaction.user.id },
        { $setOnInsert: { guildId: interaction.guild!.id, userId: interaction.user.id } },
        { upsert: true, new: true },
      );

      const now = new Date();
      if (eco.lastDaily) {
        const diff = now.getTime() - eco.lastDaily.getTime();
        if (diff < COOLDOWN_MS) {
          const remaining = COOLDOWN_MS - diff;
          const hours = Math.floor(remaining / 3600000);
          const minutes = Math.floor((remaining % 3600000) / 60000);
          await interaction.editReply({
            content: `⏳ Du hast deine tägliche Belohnung bereits abgeholt. Komm in **${hours}h ${minutes}m** wieder!`,
          });
          return;
        }
      }

      eco.balance += DAILY_AMOUNT;
      eco.lastDaily = now;
      eco.totalEarned += DAILY_AMOUNT;
      await eco.save();

      const embed = new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("🎁 Tägliche Belohnung abgeholt!")
        .setDescription(`Du hast **${DAILY_AMOUNT.toLocaleString("de-DE")} Münzen** erhalten!`)
        .addFields({ name: "Neues Guthaben", value: `🪙 ${eco.balance.toLocaleString("de-DE")} Münzen` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "taeglich Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Abholen der täglichen Belohnung." });
    }
  },
};
