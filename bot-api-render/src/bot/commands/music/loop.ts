import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../client";
import { getQueue } from "../../music/queue";

export const loopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Schaltet den Wiederholungsmodus ein/aus") as SlashCommandBuilder,

  async execute(interaction) {
    const queue = getQueue(interaction.guild!.id);
    if (!queue) {
      await interaction.reply({ content: "❌ Es wird gerade keine Musik abgespielt.", ephemeral: true });
      return;
    }

    queue.loop = !queue.loop;
    await interaction.reply({
      content: queue.loop
        ? "🔁 Wiederholungsmodus **aktiviert** — der aktuelle Song wird wiederholt."
        : "▶️ Wiederholungsmodus **deaktiviert**.",
    });
  },
};
