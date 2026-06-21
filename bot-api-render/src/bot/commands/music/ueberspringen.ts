import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import type { Command } from "../../client";
import { skipTrack } from "../../music/player";
import { getQueue } from "../../music/queue";

export const ueberspringenCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("ueberspringen")
    .setDescription("Überspringt den aktuellen Song") as SlashCommandBuilder,

  async execute(interaction) {
    const queue = getQueue(interaction.guild!.id);
    if (!queue?.current) {
      await interaction.reply({ content: "❌ Es wird gerade kein Song abgespielt.", ephemeral: true });
      return;
    }

    const skipped = skipTrack(interaction.guild!.id);
    const newQueue = getQueue(interaction.guild!.id);

    const embed = new EmbedBuilder()
      .setColor(0xf39c12)
      .setTitle("⏭️ Übersprungen")
      .setDescription(`**${skipped?.title ?? "Unbekannt"}** wurde übersprungen.`)
      .addFields({
        name: "Nächster Song",
        value: newQueue?.current?.title ?? newQueue?.tracks[0]?.title ?? "Warteschlange ist leer",
      })
      .setFooter({ text: `Übersprungen von ${interaction.user.displayName}` });

    await interaction.reply({ embeds: [embed] });
  },
};
