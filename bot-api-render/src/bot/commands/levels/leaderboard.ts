import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Level } from "../../../db/models/Level";
import { logger } from "../../../lib/logger";

export const leaderboardCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Zeigt die XP-Rangliste dieses Servers an") as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const entries = await Level.find({ guildId: interaction.guild!.id })
        .sort({ xp: -1 })
        .limit(10);

      if (entries.length === 0) {
        await interaction.editReply({ content: "❌ Noch keine Level-Daten auf diesem Server vorhanden." });
        return;
      }

      const lines = await Promise.all(
        entries.map(async (e, i) => {
          const user = await interaction.client.users.fetch(e.userId).catch(() => null);
          const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `**${i + 1}.**`;
          return `${medal} ${user?.tag ?? e.userId} — Level ${e.level} (${e.xp.toLocaleString("de-DE")} XP)`;
        }),
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🏆 ${interaction.guild!.name} Rangliste`)
        .setDescription(lines.join("\n"))
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "leaderboard Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Laden der Rangliste." });
    }
  },
};
