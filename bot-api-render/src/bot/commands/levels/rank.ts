import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { Level } from "../../../db/models/Level";
import { logger } from "../../../lib/logger";

function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level));
}

export const rankCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("rang")
    .setDescription("Zeigt deinen oder den Rang eines anderen Nutzers")
    .addUserOption((o) => o.setName("user").setDescription("Nutzer dessen Rang angezeigt wird")) as SlashCommandBuilder,

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;

    try {
      const entry = await Level.findOne({ guildId: interaction.guild!.id, userId: target.id });

      if (!entry) {
        await interaction.editReply({ content: `❌ ${target.tag} hat noch keine XP auf diesem Server.` });
        return;
      }

      const rank = await Level.countDocuments({
        guildId: interaction.guild!.id, xp: { $gt: entry.xp },
      }) + 1;

      const nextLevelXp = xpForNextLevel(entry.level);
      const progress = Math.min(100, Math.floor((entry.xp / nextLevelXp) * 100));
      const progressBar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 ${target.tag}'s Rang`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: "Rang", value: `#${rank}`, inline: true },
          { name: "Level", value: String(entry.level), inline: true },
          { name: "XP", value: `${entry.xp.toLocaleString("de-DE")} / ${nextLevelXp.toLocaleString("de-DE")}`, inline: true },
          { name: "Fortschritt", value: `${progressBar} ${progress}%` },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error({ err }, "rang Befehl Fehler");
      await interaction.editReply({ content: "❌ Fehler beim Laden des Rangs." });
    }
  },
};
