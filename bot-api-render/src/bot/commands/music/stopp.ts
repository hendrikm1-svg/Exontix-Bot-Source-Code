import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../client";
import { stopPlayback } from "../../music/player";
import { getQueue } from "../../music/queue";

export const stoppCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("stopp")
    .setDescription("Stoppt die Musik und verlässt den Sprachkanal") as SlashCommandBuilder,

  async execute(interaction) {
    const queue = getQueue(interaction.guild!.id);
    if (!queue) {
      await interaction.reply({ content: "❌ Ich spiele gerade keine Musik.", ephemeral: true });
      return;
    }

    stopPlayback(interaction.guild!.id);
    await interaction.reply({ content: "⏹️ Musik gestoppt und Sprachkanal verlassen." });
  },
};
